/**
 * Toast.tsx - Simple Toast Notification Component
 *
 * Provides success, error, and info toast notifications for comment operations
 * Positioned fixed in top-right corner with fade animations
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { ToastItem } from './useToast';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'loading';
  duration?: number; // Auto-dismiss after this many ms (0 = no auto-dismiss)
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 4000,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 300); // Wait for fade animation
  }, [onDismiss]);

  useEffect(() => {
    // Start show animation
    const showTimer = setTimeout(() => {
      setIsAnimating(true);
    }, 10);

    // Auto-dismiss if duration > 0
    let dismissTimer: NodeJS.Timeout;
    if (duration > 0) {
      dismissTimer = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    return () => {
      clearTimeout(showTimer);
      if (dismissTimer) {
        clearTimeout(dismissTimer);
      }
    };
  }, [duration, handleDismiss]);

  if (!isVisible) {
    return null;
  }

  const getIconAndStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: '✓',
          bgColor: '#10B981',
          borderColor: '#059669'
        };
      case 'error':
        return {
          icon: '✕',
          bgColor: '#EF4444',
          borderColor: '#DC2626'
        };
      case 'loading':
        return {
          icon: '⏳',
          bgColor: '#F59E0B',
          borderColor: '#D97706'
        };
      case 'info':
      default:
        return {
          icon: 'ℹ',
          bgColor: '#3B82F6',
          borderColor: '#2563EB'
        };
    }
  };

  const { icon, bgColor, borderColor } = getIconAndStyles();

  return (
    <div
      className="toast"
      style={{
        transform: isAnimating ? 'translateX(0)' : 'translateX(100%)',
        opacity: isAnimating ? 1 : 0,
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
      onClick={handleDismiss}
    >
      <div className="toast-icon">
        {type === 'loading' ? (
          <div className="loading-spinner"></div>
        ) : (
          icon
        )}
      </div>
      <div className="toast-message">{message}</div>

      <style>{`
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 8px;
          border: 2px solid;
          color: white;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          cursor: pointer;
          transition: all 0.3s ease;
          max-width: 400px;
          word-wrap: break-word;
        }

        .toast:hover {
          transform: translateX(-4px) !important;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .toast-icon {
          font-size: 16px;
          font-weight: bold;
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toast-message {
          flex: 1;
          line-height: 1.4;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};


// Toast Container Component
export const ToastContainer: React.FC<{ toasts: ToastItem[] }> = ({ toasts }) => {
  return (
    <>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            position: 'fixed',
            top: `${20 + index * 80}px`, // Stack toasts vertically
            right: '20px',
            zIndex: 9999 - index, // Newer toasts appear on top
          }}
        >
          <Toast {...toast} />
        </div>
      ))}
    </>
  );
};