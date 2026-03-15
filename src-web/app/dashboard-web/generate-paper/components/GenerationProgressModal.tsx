'use client';
import React from 'react';

interface GenerationProgressModalProps {
  progress: {
    percentage: number;
    message: string;
    isVisible: boolean;
    estimatedTimeRemaining?: number;
  };
}

export const GenerationProgressModal: React.FC<GenerationProgressModalProps> = ({ 
  progress 
}) => {
  if (!progress.isVisible) return null;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div className="modal-body p-5 text-center">
            <div className="mb-4 position-relative" style={{ height: '100px' }}>
              <div className="position-absolute top-50 start-50 translate-middle">
                <div className="spinner-border text-primary" style={{ 
                  width: '80px', 
                  height: '80px',
                  borderWidth: '8px'
                }} role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                
                <div className="position-absolute top-50 start-50 translate-middle">
                  <span className="fw-bold fs-2 text-primary">{progress.percentage}%</span>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="progress" style={{ height: '12px', borderRadius: '6px' }}>
                <div 
                  className="progress-bar progress-bar-striped progress-bar-animated" 
                  role="progressbar" 
                  style={{ 
                    width: `${progress.percentage}%`,
                    backgroundColor: '#0d6efd',
                    backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.3) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.3) 75%, transparent 75%, transparent)'
                  }}
                ></div>
              </div>
            </div>
            
            <h5 className="fw-bold mb-3 text-primary">
              {progress.message}
            </h5>
            
            {progress.estimatedTimeRemaining !== undefined && (
              <div className="mb-3">
                <small className="text-muted">
                  <i className="bi bi-clock me-1"></i>
                  Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}
                </small>
              </div>
            )}
            
            <div className="loading-dots mb-3">
              <span className="dot" style={{ 
                animation: 'bounce 1.4s infinite',
                animationDelay: '0s',
                backgroundColor: '#0d6efd'
              }}></span>
              <span className="dot" style={{ 
                animation: 'bounce 1.4s infinite',
                animationDelay: '0.2s',
                backgroundColor: '#0d6efd'
              }}></span>
              <span className="dot" style={{ 
                animation: 'bounce 1.4s infinite',
                animationDelay: '0.4s',
                backgroundColor: '#0d6efd'
              }}></span>
            </div>
            
            <p className="text-muted mt-3 small">
              Please wait while we prepare your paper...
            </p>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }
        
        .loading-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
        }
        
        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }
        
        .progress-bar-animated {
          animation: progress-bar-stripes 1s linear infinite;
        }
        
        @keyframes progress-bar-stripes {
          0% { background-position: 1rem 0; }
          100% { background-position: 0 0; }
        }
      `}</style>
    </div>
  );
};