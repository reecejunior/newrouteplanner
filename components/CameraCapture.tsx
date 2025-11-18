import React, { useRef, useEffect, useState } from 'react';
import { CameraIcon, XIcon } from './Icons';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer back camera on mobile
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsLoading(false);
      }
    } catch (err) {
      setError('Could not access camera. Please check permissions.');
      setIsLoading(false);
      console.error('Camera access error:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert canvas to blob, then to File
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(file);
        stopCamera();
        onClose();
      }
    }, 'image/jpeg', 0.9);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-brand-text">
          <h3 className="text-lg font-bold text-white">Take Photo</h3>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-white hover:text-red-300 transition"
            aria-label="Close camera"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Video Preview */}
        <div className="relative bg-black aspect-video flex items-center justify-center">
          {isLoading && (
            <div className="text-white">Loading camera...</div>
          )}
          {error && (
            <div className="text-red-400 p-4 text-center">
              <p>{error}</p>
              <button
                onClick={startCamera}
                className="mt-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
              >
                Retry
              </button>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${isLoading || error ? 'hidden' : ''}`}
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="p-6 bg-white flex items-center justify-center gap-4">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-6 py-2 bg-medium hover:bg-slate-300 text-content-100 font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={capturePhoto}
            disabled={isLoading || !!error}
            className="px-8 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white font-bold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CameraIcon className="w-6 h-6" />
            Capture
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;

