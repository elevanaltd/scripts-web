/**
 * useToast.tsx - Toast Hook
 *
 * Separated from Toast.tsx to fix React Fast Refresh warning
 * Export non-component utilities separately from component files
 */

import { useState } from 'react';
import type { ToastProps } from './Toast';

export interface ToastItem extends ToastProps {
  id: string;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (props: Omit<ToastProps, 'onDismiss'>) => {
    const id = Date.now().toString();
    const newToast: ToastItem = {
      ...props,
      id,
      onDismiss: () => removeToast(id)
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (message: string) => showToast({ message, type: 'success' });
  const showError = (message: string) => showToast({ message, type: 'error' });
  const showInfo = (message: string) => showToast({ message, type: 'info' });
  const showLoading = (message: string) => showToast({ message, type: 'loading', duration: 0 });

  return {
    toasts,
    showSuccess,
    showError,
    showInfo,
    showLoading,
    removeToast,
  };
};