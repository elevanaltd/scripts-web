/**
 * Error Handling Utilities
 *
 * Comprehensive error handling utilities for the comments system and other async operations.
 * Provides retry logic, user-friendly error messages, and proper error categorization.
 *
 * Critical-Engineer: consulted for robust error handling patterns
 */

import { useMemo } from 'react';
import { Logger } from '../services/logger';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitter: boolean;
}

export interface ErrorInfo {
  code: string;
  message: string;
  isRetryable: boolean;
  userMessage: string;
  category: 'network' | 'authentication' | 'permission' | 'validation' | 'server' | 'unknown';
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  exponentialBase: 2,
  jitter: true,
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Calculate retry delay with exponential backoff and optional jitter
 */
function calculateRetryDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = Math.min(
    config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1),
    config.maxDelayMs
  );

  if (!config.jitter) {
    return exponentialDelay;
  }

  // Add jitter: random value between 50% and 100% of calculated delay
  const jitterFactor = 0.5 + Math.random() * 0.5;
  return Math.floor(exponentialDelay * jitterFactor);
}

/**
 * Categorize error and provide user-friendly message
 */
export function categorizeError(error: Error | string | unknown): ErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Server errors (check before network to avoid false categorization)
  if (
    lowerMessage.includes('500') ||
    lowerMessage.includes('internal server error') ||
    lowerMessage.includes('database') ||
    lowerMessage.includes('server error')
  ) {
    return {
      code: 'SERVER_ERROR',
      message,
      isRetryable: true,
      userMessage: 'Server error occurred. Please try again in a few moments.',
      category: 'server',
    };
  }

  // Network-related errors
  if (
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('network') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('503') ||
    lowerMessage.includes('502') ||
    lowerMessage.includes('504')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message,
      isRetryable: true,
      userMessage: 'Connection problem. Please check your internet connection and try again.',
      category: 'network',
    };
  }

  // Authentication errors
  if (
    lowerMessage.includes('401') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('session expired') ||
    lowerMessage.includes('login')
  ) {
    return {
      code: 'AUTHENTICATION_ERROR',
      message,
      isRetryable: false,
      userMessage: 'Your session has expired. Please log in again.',
      category: 'authentication',
    };
  }

  // Permission errors
  if (
    lowerMessage.includes('403') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('permission') ||
    lowerMessage.includes('access denied')
  ) {
    return {
      code: 'PERMISSION_ERROR',
      message,
      isRetryable: false,
      userMessage: 'You don\'t have permission to perform this action.',
      category: 'permission',
    };
  }

  // Validation errors
  if (
    lowerMessage.includes('400') ||
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('bad request')
  ) {
    return {
      code: 'VALIDATION_ERROR',
      message,
      isRetryable: false,
      userMessage: 'Please check your input and try again.',
      category: 'validation',
    };
  }


  // Default unknown error
  return {
    code: 'UNKNOWN_ERROR',
    message,
    isRetryable: true,
    userMessage: 'An unexpected error occurred. Please try again.',
    category: 'unknown',
  };
}

/**
 * Check if an error should be retried based on categorization
 */
export function shouldRetryError(error: Error | string | unknown): boolean {
  const errorInfo = categorizeError(error);
  return errorInfo.isRetryable;
}

/**
 * Get user-friendly error message while hiding sensitive information
 * Now supports context-specific messages based on operation type
 */
export function getUserFriendlyErrorMessage(
  error: Error | string | unknown,
  context?: {
    operation?: 'load' | 'create' | 'update' | 'delete' | 'resolve' | 'unresolve' | 'reply';
    resource?: string; // e.g., 'comments', 'comment', 'reply'
  }
): string {
  const errorInfo = categorizeError(error);

  // If context provided, generate context-specific message
  if (context?.operation && context?.resource) {
    const { operation, resource } = context;

    // Network errors - operation-specific
    if (errorInfo.category === 'network') {
      if (operation === 'load') return `Unable to load ${resource}. Please check your connection and try again.`;
      if (operation === 'create') return `Error creating ${resource}. Please try again.`;
      if (operation === 'update') return `Error updating ${resource}. Please try again.`;
      if (operation === 'delete') return `Error deleting ${resource}. Please try again.`;
      if (operation === 'resolve') return `Error resolving ${resource}. Please try again.`;
      if (operation === 'unresolve') return `Error reopening ${resource}. Please try again.`;
      if (operation === 'reply') return `Error creating ${resource}. Please try again.`;
    }

    // Authentication errors - operation-specific
    if (errorInfo.category === 'authentication') {
      return 'Your session has expired. Please log in again.';
    }

    // Permission errors - operation-specific
    if (errorInfo.category === 'permission') {
      if (operation === 'delete') return `Cannot delete this ${resource}. You don't have permission.`;
      if (operation === 'update') return `Cannot edit this ${resource}. You don't have permission.`;
      if (operation === 'reply') return `Cannot reply to this ${resource}. You don't have permission.`;
      return `You don't have permission to ${operation} this ${resource}.`;
    }

    // Validation errors - use the actual error message if available
    if (errorInfo.category === 'validation') {
      // If the error message itself is user-friendly (like "Comment content is required"), use it
      const message = error instanceof Error ? error.message : String(error);
      if (message && !message.includes('400') && !message.toLowerCase().includes('bad request')) {
        return message;
      }
      return `Please check your input and try again.`;
    }
  }

  // Fallback to generic message
  return errorInfo.userMessage;
}

/**
 * Sanitize error message for logging (remove sensitive data)
 */
export function sanitizeErrorForLogging(error: Error | string | unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  // Patterns that might contain sensitive information
  const sensitivePatterns = [
    { pattern: /api[_-]?key[=:]\s*['"]*[a-zA-Z0-9]+['"]*?/gi, replacement: 'api_key=[REDACTED]' },
    { pattern: /password[=:]\s*['"]*[^'"]+['"]*?/gi, replacement: 'password=[REDACTED]' },
    { pattern: /secret[=:]\s*['"]*[^'"]+['"]*?/gi, replacement: 'secret=[REDACTED]' },
    { pattern: /token[=:]\s*['"]*[^'"]+['"]*?/gi, replacement: 'token=[REDACTED]' },
    { pattern: /sk-[a-zA-Z0-9]+/gi, replacement: 'sk-[REDACTED]' },
    { pattern: /postgres:\/\/[^@]+@/gi, replacement: 'postgres://[REDACTED]@' },
    { pattern: /mysql:\/\/[^@]+@/gi, replacement: 'mysql://[REDACTED]@' },
    { pattern: /mongodb:\/\/[^@]+@/gi, replacement: 'mongodb://[REDACTED]@' },
  ];

  let sanitized = message;
  for (const { pattern, replacement } of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

/**
 * Retry function with exponential backoff and proper error handling
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();

      // Log successful retry if this wasn't the first attempt
      if (attempt > 1) {
        Logger.info(`Operation succeeded after ${attempt} attempts`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // Log the attempt
      Logger.warn(`Attempt ${attempt}/${finalConfig.maxAttempts} failed`, {
        error: sanitizeErrorForLogging(error),
        attempt,
        willRetry: attempt < finalConfig.maxAttempts && shouldRetryError(error),
      });

      // If this is the last attempt or error is not retryable, throw
      if (attempt === finalConfig.maxAttempts || !shouldRetryError(error)) {
        break;
      }

      // Calculate and apply delay before retry
      const delay = calculateRetryDelay(attempt, finalConfig);
      Logger.debug(`Waiting ${delay}ms before retry attempt ${attempt + 1}`);
      await sleep(delay);
    }
  }

  // All attempts failed, throw the last error
  throw lastError;
}

/**
 * Create a retryable version of an async function
 */
export function makeRetryable<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  config: Partial<RetryConfig> = {}
) {
  return async (...args: TArgs): Promise<TReturn> => {
    return withRetry(() => fn(...args), config);
  };
}

/**
 * Error boundary for async operations that provides consistent error handling
 */
export class AsyncErrorBoundary {
  private operation: string;
  private logger: typeof Logger;

  constructor(operation: string) {
    this.operation = operation;
    this.logger = Logger;
  }

  async execute<T>(
    asyncFn: () => Promise<T>,
    onError?: (error: ErrorInfo) => void,
    retryConfig?: Partial<RetryConfig>
  ): Promise<{ success: true; data: T } | { success: false; error: ErrorInfo }> {
    try {
      const data = await withRetry(asyncFn, retryConfig);
      return { success: true, data };
    } catch (error) {
      const errorInfo = categorizeError(error);

      // Log the error
      this.logger.error(`${this.operation} failed`, {
        error: sanitizeErrorForLogging(error),
        errorCode: errorInfo.code,
        category: errorInfo.category,
        isRetryable: errorInfo.isRetryable,
      });

      // Call error handler if provided
      if (onError) {
        onError(errorInfo);
      }

      return { success: false, error: errorInfo };
    }
  }
}

/**
 * Global error handler for unhandled promise rejections
 */
export function setupGlobalErrorHandling(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    Logger.error('Unhandled promise rejection', {
      error: sanitizeErrorForLogging(event.reason),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });

    // Prevent default browser behavior (console error)
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    Logger.error('Uncaught error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  });
}

/**
 * Error handling hook for React components
 *
 * CRITICAL FIX: Using useMemo to create stable function references
 * This prevents infinite re-render loops caused by unstable dependencies
 */
export function useErrorHandling(operation: string) {
  // Create stable boundary instance that only changes when operation changes
  const boundary = useMemo(() => new AsyncErrorBoundary(operation), [operation]);

  // Create stable function reference that only changes when boundary changes
  const stableExecute = useMemo(
    () => boundary.execute.bind(boundary),
    [boundary]
  );

  return {
    executeWithErrorHandling: stableExecute,
    categorizeError,
    getUserFriendlyErrorMessage,
    withRetry,
  };
}