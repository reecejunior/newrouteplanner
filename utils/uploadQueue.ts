import { PendingUpload } from '../types';
import { extractAddressesFromWebhook } from '../services/webhookService';

const MAX_CONCURRENT_UPLOADS = 5;

class UploadQueue {
  private pendingUploads: Map<string, PendingUpload> = new Map();
  private processingUploads: Set<string> = new Set();
  private callbacks: Map<string, (upload: PendingUpload) => void> = new Map();

  addUpload(file: File, onUpdate: (upload: PendingUpload) => void): string {
    const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create thumbnail
    const thumbnail = URL.createObjectURL(file);

    const upload: PendingUpload = {
      id,
      file,
      status: 'pending',
      timestamp: Date.now(),
      thumbnail,
    };

    this.pendingUploads.set(id, upload);
    this.callbacks.set(id, onUpdate);

    // Start processing if under limit
    this.processQueue();

    return id;
  }

  private async processQueue() {
    // Check if we can process more uploads
    if (this.processingUploads.size >= MAX_CONCURRENT_UPLOADS) {
      return;
    }

    // Find next pending upload
    const nextUpload = Array.from(this.pendingUploads.values()).find(
      upload => upload.status === 'pending' && !this.processingUploads.has(upload.id)
    );

    if (!nextUpload) {
      return;
    }

    // Mark as processing
    this.processingUploads.add(nextUpload.id);
    this.updateUploadStatus(nextUpload.id, 'processing');

    // Process the upload
    this.processUpload(nextUpload.id);
  }

  private async processUpload(id: string) {
    const upload = this.pendingUploads.get(id);
    if (!upload) return;

    try {
      // Convert file to base64
      const base64Image = await this.fileToBase64(upload.file);
      const mimeType = upload.file.type || 'image/jpeg';

      // Call webhook
      const addresses = await extractAddressesFromWebhook(base64Image, mimeType);

      // Update upload with results
      this.updateUploadStatus(id, 'completed', addresses);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.updateUploadStatus(id, 'failed', undefined, errorMessage);
    } finally {
      // Remove from processing set
      this.processingUploads.delete(id);

      // Process next in queue
      this.processQueue();
    }
  }

  private updateUploadStatus(
    id: string,
    status: PendingUpload['status'],
    addresses?: string[],
    error?: string
  ) {
    const upload = this.pendingUploads.get(id);
    if (!upload) return;

    const updatedUpload: PendingUpload = {
      ...upload,
      status,
      addresses,
      error,
    };

    this.pendingUploads.set(id, updatedUpload);

    // Notify callback
    const callback = this.callbacks.get(id);
    if (callback) {
      callback(updatedUpload);
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  }

  getUpload(id: string): PendingUpload | undefined {
    return this.pendingUploads.get(id);
  }

  getAllUploads(): PendingUpload[] {
    return Array.from(this.pendingUploads.values());
  }

  removeUpload(id: string) {
    const upload = this.pendingUploads.get(id);
    if (upload?.thumbnail) {
      URL.revokeObjectURL(upload.thumbnail);
    }
    this.pendingUploads.delete(id);
    this.callbacks.delete(id);
    this.processingUploads.delete(id);
  }

  retryUpload(id: string) {
    const upload = this.pendingUploads.get(id);
    if (!upload || upload.status !== 'failed') return;

    // Reset to pending
    this.updateUploadStatus(id, 'pending');
    this.processQueue();
  }

  clearCompleted() {
    const completedIds = Array.from(this.pendingUploads.entries())
      .filter(([_, upload]) => upload.status === 'completed')
      .map(([id]) => id);

    completedIds.forEach(id => this.removeUpload(id));
  }
}

// Singleton instance
export const uploadQueue = new UploadQueue();

