import React from 'react';
import { PendingUpload } from '../types';
import { CheckIcon, ErrorIcon, RetryIcon, XIcon } from './Icons';
import Spinner from './Spinner';

interface PendingUploadItemProps {
  upload: PendingUpload;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}

const PendingUploadItem: React.FC<PendingUploadItemProps> = ({ upload, onRetry, onDismiss }) => {
  const getStatusIcon = () => {
    switch (upload.status) {
      case 'completed':
        return <CheckIcon className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <ErrorIcon className="w-5 h-5 text-red-600" />;
      case 'processing':
        return <Spinner />;
      default:
        return <Spinner />;
    }
  };

  const getStatusText = () => {
    switch (upload.status) {
      case 'completed':
        const count = upload.addresses?.length || 0;
        return count > 0 
          ? `Extracted ${count} address${count !== 1 ? 'es' : ''}`
          : 'No addresses found';
      case 'failed':
        return upload.error || 'Failed to extract addresses';
      case 'processing':
        return 'Processing...';
      default:
        return 'Waiting...';
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-medium rounded-lg animate-fade-in-sm">
      {/* Thumbnail */}
      {upload.thumbnail && (
        <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-medium">
          <img 
            src={upload.thumbnail} 
            alt="Upload preview" 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Status and Info */}
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${
            upload.status === 'completed' ? 'text-green-700' :
            upload.status === 'failed' ? 'text-red-700' :
            'text-content-200'
          }`}>
            {getStatusText()}
          </span>
        </div>
        {upload.status === 'failed' && (
          <button
            onClick={() => onRetry(upload.id)}
            className="text-xs text-brand-text hover:text-brand-primary font-semibold flex items-center gap-1 mt-1"
          >
            <RetryIcon className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {(upload.status === 'failed' || upload.status === 'completed') && (
        <button
          onClick={() => onDismiss(upload.id)}
          className="flex-shrink-0 text-content-200 hover:text-red-500 p-1 rounded-full transition"
          aria-label="Dismiss"
        >
          <XIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default PendingUploadItem;

