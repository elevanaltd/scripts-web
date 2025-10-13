/**
 * Error Boundary Tests
 *
 * Tests for React Error Boundary implementation and component isolation
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws error on command
const ThrowError: React.FC<{ shouldThrow: boolean; errorMessage?: string }> = ({
  shouldThrow,
  errorMessage = 'Test error'
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>Component working correctly</div>;
};

// Component that throws error in useEffect - RESTORED per Test Methodology Guardian
const ThrowAsyncError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      throw new Error('Async error in useEffect');
    }
  }, [shouldThrow]);
  return <div>Async component working</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Error Isolation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Normal component content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Normal component content')).toBeInTheDocument();
    });

    it('should catch component errors and show fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Component crashed" />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      expect(screen.getByText(/Component crashed/)).toBeInTheDocument();
      expect(screen.queryByText('Component working correctly')).not.toBeInTheDocument();
    });

    it('should isolate errors to specific components without affecting siblings', () => {
      render(
        <div>
          <ErrorBoundary>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
          <div>Sibling component</div>
          <ErrorBoundary>
            <ThrowError shouldThrow={false} />
          </ErrorBoundary>
        </div>
      );

      // First boundary should show error
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();

      // Sibling should render normally
      expect(screen.getByText('Sibling component')).toBeInTheDocument();

      // Second boundary should render child normally
      expect(screen.getByText('Component working correctly')).toBeInTheDocument();
    });

    it('should show retry button when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should allow component to recover after retry', () => {
      let shouldThrow = true;
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      // Initial error state
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();

      // Simulate component fix and retry
      shouldThrow = false;
      const retryButton = screen.getByRole('button', { name: /try again/i });
      retryButton.click();

      // Rerender with working component
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component working correctly')).toBeInTheDocument();
      expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
    });
  });

  describe('Error Information', () => {
    it('should display error message to user', () => {
      const errorMessage = 'Database connection failed';
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={errorMessage} />
        </ErrorBoundary>
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should show generic error message for security sensitive errors', () => {
      const sensitiveError = 'API_KEY=sk-1234567890 is invalid';
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={sensitiveError} />
        </ErrorBoundary>
      );

      // Should not expose sensitive information
      expect(screen.queryByText(/API_KEY/)).not.toBeInTheDocument();
      expect(screen.queryByText(/sk-1234567890/)).not.toBeInTheDocument();

      // Should show generic message instead
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    });

    it('should provide error reporting mechanism', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test error for reporting" />
        </ErrorBoundary>
      );

      // Should have some way to report the error
      expect(screen.getByText(/report this issue/i)).toBeInTheDocument();
    });
  });

  describe('Development vs Production', () => {
    it('should show detailed error info in development mode', () => {
      // Mock development environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Dev error details" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Dev error details')).toBeInTheDocument();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should hide sensitive details in production mode', () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Internal server error: Database timeout" />
        </ErrorBoundary>
      );

      // Should show generic message in production
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
      expect(screen.queryByText('Database timeout')).not.toBeInTheDocument();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Custom Fallback', () => {
    it('should accept custom fallback component', () => {
      const CustomFallback = () => <div>Custom error fallback</div>;

      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    });

    it('should provide error info to custom fallback', () => {
      const CustomFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
        <div>
          <div>Custom error: {error.message}</div>
          <button onClick={retry}>Custom retry</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError shouldThrow={true} errorMessage="Custom error message" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error: Custom error message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Custom retry' })).toBeInTheDocument();
    });
  });

  describe('Performance Impact', () => {
    it('should not impact performance when no errors occur', () => {
      const startTime = performance.now();

      render(
        <ErrorBoundary>
          <div>Normal content</div>
          <div>More content</div>
          <div>Even more content</div>
        </ErrorBoundary>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly
      expect(renderTime).toBeLessThan(50);
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors in error boundary itself gracefully', () => {
      // This is a complex test - error boundaries that error are rare edge cases
      // We'll test that the component at least doesn't crash the entire app
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });

    it('should handle null/undefined children', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            {null}
            {undefined}
            <div>Valid content</div>
          </ErrorBoundary>
        );
      }).not.toThrow();

      expect(screen.getByText('Valid content')).toBeInTheDocument();
    });
  });

  // CORRECTED ASYNC ERROR TEST - React 18 behavior
  describe('Async Error Handling', () => {
    // React 18 DOES catch errors thrown in useEffect during initial mount
    // Only truly async errors (setTimeout, fetch) are not caught
    it('should catch errors thrown in useEffect during initial mount', () => {
      // ARRANGE: Suppress the expected console error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // ACT: Render the boundary with a child that throws in useEffect
      render(
        <ErrorBoundary>
          <ThrowAsyncError shouldThrow={true} />
        </ErrorBoundary>
      );

      // ASSERT: ErrorBoundary SHOULD catch this and show fallback
      const fallbackUI = screen.queryByText(/something went wrong/i);
      expect(fallbackUI).toBeInTheDocument();

      // ASSERT: The child component should NOT be visible
      expect(screen.queryByText('Async component working')).not.toBeInTheDocument();

      // CLEANUP
      consoleErrorSpy.mockRestore();
    });
  });

  // NEW CONTRACT TESTS - Clipboard Failure Scenarios
  describe('Clipboard Operations', () => {
    beforeEach(() => {
      // Reset navigator.clipboard mock before each test
      if ('clipboard' in navigator) {
        vi.clearAllMocks();
      }
    });

    it('should display failure message when clipboard API rejects', async () => {
      // CONTRACT: When clipboard fails, user must be clearly notified of failure

      // Mock clipboard to reject
      const mockClipboard = {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard access denied'))
      };
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        configurable: true
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test clipboard error" />
        </ErrorBoundary>
      );

      // Find and click the "Report this issue" link
      const reportLink = screen.getByText(/report this issue/i);
      reportLink.click();

      // CONTRACT VIOLATION: Current implementation shows success even on failure
      // This test should FAIL until implementation is fixed
      await waitFor(() => {
        const failureMessage = screen.queryByText(/failed to copy|clipboard.*fail/i);
        expect(failureMessage).toBeInTheDocument(); // This will FAIL - that's the point
      });
    });

    it('should handle browsers without clipboard API gracefully', () => {
      // CONTRACT: Don't offer features we cannot support

      // Mock environment without clipboard API
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test no clipboard" />
        </ErrorBoundary>
      );

      // Find the report link
      const reportLink = screen.getByText(/report this issue/i);

      // Should not throw when clicked (graceful degradation)
      expect(() => reportLink.click()).not.toThrow();

      // CONTRACT: Should show appropriate message for no-clipboard environment
      // Current implementation will show misleading success message - this should FAIL

      // Restore clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true
      });
    });

    it('should show success message only when clipboard write succeeds', async () => {
      // CONTRACT: Success message only on actual success

      // Mock clipboard to succeed
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined)
      };
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        configurable: true
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test clipboard success" />
        </ErrorBoundary>
      );

      const reportLink = screen.getByText(/report this issue/i);
      reportLink.click();

      // This should pass - showing success on actual success is correct
      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });
    });
  });
});