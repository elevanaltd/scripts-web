/**
 * Error Handling Utilities Tests
 *
 * TDD tests for comprehensive error handling utilities.
 * Following TDD methodology: RED (failing tests) → GREEN (implementation) → REFACTOR
 *
 * Critical-Engineer: consulted for comprehensive error scenario coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  categorizeError,
  shouldRetryError,
  getUserFriendlyErrorMessage,
  sanitizeErrorForLogging,
  withRetry,
  makeRetryable,
  AsyncErrorBoundary,
  setupGlobalErrorHandling,
  useErrorHandling,
} from './errorHandling';
import { Logger } from '../services/logger';

// Mock Logger
vi.mock('../services/logger', () => ({
  Logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Error Handling Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers for each test that needs them
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('categorizeError', () => {
    it('should categorize network errors correctly', () => {
      const networkErrors = [
        'Failed to fetch',
        'Network request failed',
        'Connection timeout',
        '503 Service Unavailable',
        '502 Bad Gateway',
        '504 Gateway Timeout',
      ];

      networkErrors.forEach(message => {
        const error = new Error(message);
        const result = categorizeError(error);

        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.category).toBe('network');
        expect(result.isRetryable).toBe(true);
        expect(result.userMessage).toContain('Connection problem');
      });
    });

    it('should categorize authentication errors correctly', () => {
      const authErrors = [
        '401 Unauthorized',
        'Authentication failed',
        'Session expired',
        'Login required',
      ];

      authErrors.forEach(message => {
        const error = new Error(message);
        const result = categorizeError(error);

        expect(result.code).toBe('AUTHENTICATION_ERROR');
        expect(result.category).toBe('authentication');
        expect(result.isRetryable).toBe(false);
        expect(result.userMessage).toContain('session has expired');
      });
    });

    it('should categorize permission errors correctly', () => {
      const permissionErrors = [
        '403 Forbidden',
        'Permission denied',
        'Access denied',
        'Insufficient permissions',
      ];

      permissionErrors.forEach(message => {
        const error = new Error(message);
        const result = categorizeError(error);

        expect(result.code).toBe('PERMISSION_ERROR');
        expect(result.category).toBe('permission');
        expect(result.isRetryable).toBe(false);
        expect(result.userMessage).toContain('don\'t have permission');
      });
    });

    it('should categorize validation errors correctly', () => {
      const validationErrors = [
        '400 Bad Request',
        'Validation failed',
        'Invalid input',
        'Field is required',
      ];

      validationErrors.forEach(message => {
        const error = new Error(message);
        const result = categorizeError(error);

        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.category).toBe('validation');
        expect(result.isRetryable).toBe(false);
        expect(result.userMessage).toContain('check your input');
      });
    });

    it('should categorize server errors correctly', () => {
      const serverErrors = [
        '500 Internal Server Error',
        'Database connection failed',
        'Server error occurred',
      ];

      serverErrors.forEach(message => {
        const error = new Error(message);
        const result = categorizeError(error);

        expect(result.code).toBe('SERVER_ERROR');
        expect(result.category).toBe('server');
        expect(result.isRetryable).toBe(true);
        expect(result.userMessage).toContain('Server error');
      });
    });

    it('should categorize unknown errors as retryable', () => {
      const unknownError = new Error('Some weird error');
      const result = categorizeError(unknownError);

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.category).toBe('unknown');
      expect(result.isRetryable).toBe(true);
      expect(result.userMessage).toContain('unexpected error');
    });

    it('should handle non-Error objects', () => {
      const stringError = 'String error message';
      const objectError = { message: 'Object error' };
      const nullError = null;

      expect(() => categorizeError(stringError)).not.toThrow();
      expect(() => categorizeError(objectError)).not.toThrow();
      expect(() => categorizeError(nullError)).not.toThrow();
    });
  });

  describe('shouldRetryError', () => {
    it('should return true for retryable errors', () => {
      const retryableErrors = [
        new Error('Network timeout'),
        new Error('500 Internal Server Error'),
        new Error('503 Service Unavailable'),
        new Error('Unknown error'),
      ];

      retryableErrors.forEach(error => {
        expect(shouldRetryError(error)).toBe(true);
      });
    });

    it('should return false for non-retryable errors', () => {
      const nonRetryableErrors = [
        new Error('401 Unauthorized'),
        new Error('403 Forbidden'),
        new Error('400 Bad Request'),
        new Error('Validation failed'),
      ];

      nonRetryableErrors.forEach(error => {
        expect(shouldRetryError(error)).toBe(false);
      });
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    it('should return user-friendly messages for all error types', () => {
      const testCases = [
        { error: new Error('Network timeout'), expected: /connection/i },
        { error: new Error('401 Unauthorized'), expected: /session.*expired/i },
        { error: new Error('403 Forbidden'), expected: /permission/i },
        { error: new Error('400 Bad Request'), expected: /input/i },
        { error: new Error('500 Server Error'), expected: /server.*error/i },
        { error: new Error('Unknown'), expected: /unexpected.*error/i },
      ];

      testCases.forEach(({ error, expected }) => {
        const message = getUserFriendlyErrorMessage(error);
        expect(message).toMatch(expected);
      });
    });

    it('should never expose sensitive information', () => {
      const sensitiveErrors = [
        new Error('API key sk-1234567890 is invalid'),
        new Error('Database password expired for admin'),
        new Error('Secret token abc123xyz failed'),
      ];

      sensitiveErrors.forEach(error => {
        const message = getUserFriendlyErrorMessage(error);
        expect(message).not.toContain('sk-1234567890');
        expect(message).not.toContain('admin');
        expect(message).not.toContain('abc123xyz');
        expect(message).not.toContain('password');
        expect(message).not.toContain('secret');
        expect(message).not.toContain('token');
      });
    });
  });

  describe('sanitizeErrorForLogging', () => {
    it('should redact sensitive information from error messages', () => {
      const sensitiveData = [
        { input: 'API_KEY=sk-1234567890', expected: 'api_key=[REDACTED]' },
        { input: 'password=mypassword123', expected: 'password=[REDACTED]' },
        { input: 'secret=topsecret', expected: 'secret=[REDACTED]' },
        { input: 'token=abc123xyz', expected: 'token=[REDACTED]' },
        { input: 'Connection: postgres://user:pass@host', expected: 'postgres://[REDACTED]@host' },
      ];

      sensitiveData.forEach(({ input, expected }) => {
        const sanitized = sanitizeErrorForLogging(new Error(input));
        expect(sanitized.toLowerCase()).toContain(expected.toLowerCase());
      });
    });

    it('should preserve non-sensitive information', () => {
      const error = new Error('Database connection failed at line 123');
      const sanitized = sanitizeErrorForLogging(error);

      expect(sanitized).toContain('Database connection failed');
      expect(sanitized).toContain('line 123');
    });

    it('should handle non-Error objects', () => {
      const stringError = 'password=secret123';
      const sanitized = sanitizeErrorForLogging(stringError);

      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('secret123');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt if operation succeeds', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await withRetry(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry failed operations with exponential backoff', async () => {
      vi.useFakeTimers();

      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');

      const resultPromise = withRetry(mockOperation, {
        maxAttempts: 3,
        baseDelayMs: 100,
      });

      // Fast-forward through delays
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(Logger.warn).toHaveBeenCalledTimes(2); // Two failed attempts
      expect(Logger.info).toHaveBeenCalledWith('Operation succeeded after 3 attempts');
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

      await expect(withRetry(mockOperation)).rejects.toThrow('401 Unauthorized');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should give up after max attempts', async () => {
      const persistentError = new Error('503 Service Unavailable');
      const mockOperation = vi.fn().mockRejectedValue(persistentError);

      await expect(withRetry(mockOperation, { maxAttempts: 2 })).rejects.toThrow(persistentError);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should apply jitter to delays', async () => {
      vi.useFakeTimers();

      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');

      // Mock Math.random to return consistent values
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.5);

      const resultPromise = withRetry(mockOperation, {
        baseDelayMs: 1000,
        jitter: true,
      });

      await vi.runAllTimersAsync();
      await resultPromise;

      // Restore Math.random
      Math.random = originalRandom;

      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should log retry attempts', async () => {
      vi.useFakeTimers();

      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');

      const resultPromise = withRetry(mockOperation);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(Logger.warn).toHaveBeenCalledWith(
        'Attempt 1/3 failed',
        expect.objectContaining({
          attempt: 1,
          willRetry: true,
        })
      );
    });
  });

  describe('makeRetryable', () => {
    it('should create a retryable version of a function', async () => {
      vi.useFakeTimers();

      const originalFn = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');

      const retryableFn = makeRetryable(originalFn);

      const resultPromise = retryableFn('arg1', 'arg2');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
      expect(originalFn).toHaveBeenCalledTimes(2);
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('AsyncErrorBoundary', () => {
    it('should return success result for successful operations', async () => {
      const boundary = new AsyncErrorBoundary('test operation');
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await boundary.execute(mockFn);

      expect(result).toEqual({ success: true, data: 'success' });
    });

    it('should return error result for failed operations', async () => {
      const boundary = new AsyncErrorBoundary('test operation');
      const mockFn = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await boundary.execute(mockFn);

      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: 'NETWORK_ERROR',
          category: 'network',
          isRetryable: true,
        }),
      });

      expect(Logger.error).toHaveBeenCalledWith(
        'test operation failed',
        expect.objectContaining({
          errorCode: 'NETWORK_ERROR',
          category: 'network',
          isRetryable: true,
        })
      );
    });

    it('should call error handler when provided', async () => {
      const boundary = new AsyncErrorBoundary('test operation');
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const mockErrorHandler = vi.fn();

      await boundary.execute(mockFn, mockErrorHandler);

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'UNKNOWN_ERROR',
          message: 'Test error',
        })
      );
    });

    it('should apply retry configuration', async () => {
      vi.useFakeTimers();

      const boundary = new AsyncErrorBoundary('test operation');
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce('success');

      const resultPromise = boundary.execute(mockFn, undefined, { maxAttempts: 2 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ success: true, data: 'success' });
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('setupGlobalErrorHandling', () => {
    it('should set up global error handlers', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      setupGlobalErrorHandling();

      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should log unhandled promise rejections', () => {
      setupGlobalErrorHandling();

      // Create a promise that we'll handle to prevent actual unhandled rejection
      const rejectedPromise = Promise.reject(new Error('Unhandled rejection'));
      // Catch it to prevent test failure, but after we dispatch the event
      rejectedPromise.catch(() => {});

      // Create a custom event since PromiseRejectionEvent may not be available in test environment
      const rejectionEvent = new CustomEvent('unhandledrejection', {
        detail: {
          reason: new Error('Unhandled rejection'),
          promise: rejectedPromise,
        }
      }) as CustomEvent & { reason: Error; preventDefault: () => void };

      // Add the properties that the handler expects
      rejectionEvent.reason = new Error('Unhandled rejection');
      rejectionEvent.preventDefault = vi.fn();

      window.dispatchEvent(rejectionEvent);

      expect(Logger.error).toHaveBeenCalledWith(
        'Unhandled promise rejection',
        expect.objectContaining({
          url: window.location.href,
          userAgent: navigator.userAgent,
        })
      );
    });

    it('should log uncaught errors', () => {
      setupGlobalErrorHandling();

      // Simulate uncaught error
      const errorEvent = new ErrorEvent('error', {
        message: 'Uncaught error',
        filename: 'test.js',
        lineno: 123,
        colno: 45,
      });

      window.dispatchEvent(errorEvent);

      expect(Logger.error).toHaveBeenCalledWith(
        'Uncaught error',
        expect.objectContaining({
          message: 'Uncaught error',
          filename: 'test.js',
          lineno: 123,
          colno: 45,
        })
      );
    });
  });

  describe('useErrorHandling', () => {
    it('should return error handling utilities', () => {
      const { result } = renderHook(() => useErrorHandling('test'));

      expect(result.current.executeWithErrorHandling).toBeDefined();
      expect(result.current.categorizeError).toBe(categorizeError);
      expect(result.current.getUserFriendlyErrorMessage).toBe(getUserFriendlyErrorMessage);
      expect(result.current.withRetry).toBe(withRetry);
    });

    it('should create AsyncErrorBoundary with correct operation name', async () => {
      const { result } = renderHook(() => useErrorHandling('user operation'));
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await result.current.executeWithErrorHandling(mockFn);

      expect(Logger.error).toHaveBeenCalledWith(
        'user operation failed',
        expect.any(Object)
      );
    });
  });
});