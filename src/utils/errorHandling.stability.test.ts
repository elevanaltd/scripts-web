/**
 * Hook Stability Test
 *
 * CRITICAL: This test verifies that useErrorHandling returns stable function references
 * This prevents infinite re-render loops in React components
 *
 * Context: This test was added to catch the infinite loop bug that occurred in CommentSidebar
 * where unstable executeWithErrorHandling references caused continuous re-renders
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useErrorHandling } from './errorHandling';

describe('useErrorHandling hook stability', () => {
  it('should return stable executeWithErrorHandling reference across re-renders', () => {
    // Render the hook
    const { result, rerender } = renderHook(
      ({ operation }) => useErrorHandling(operation),
      {
        initialProps: { operation: 'test operation' },
      }
    );

    // Capture the initial reference
    const firstExecuteRef = result.current.executeWithErrorHandling;

    // Re-render with the same props
    rerender({ operation: 'test operation' });

    // Capture the reference after re-render
    const secondExecuteRef = result.current.executeWithErrorHandling;

    // CRITICAL: These must be the same reference to prevent infinite loops
    expect(secondExecuteRef).toBe(firstExecuteRef);
  });

  it('should create new executeWithErrorHandling reference when operation changes', () => {
    // Render the hook
    const { result, rerender } = renderHook(
      ({ operation }) => useErrorHandling(operation),
      {
        initialProps: { operation: 'operation 1' },
      }
    );

    // Capture the initial reference
    const firstExecuteRef = result.current.executeWithErrorHandling;

    // Re-render with different operation
    rerender({ operation: 'operation 2' });

    // Capture the reference after re-render
    const secondExecuteRef = result.current.executeWithErrorHandling;

    // Should be different reference when operation changes
    expect(secondExecuteRef).not.toBe(firstExecuteRef);
  });

  it('should maintain stable references for utility functions', () => {
    // Render the hook
    const { result, rerender } = renderHook(
      ({ operation }) => useErrorHandling(operation),
      {
        initialProps: { operation: 'test' },
      }
    );

    // Capture initial utility function references
    const firstCategorize = result.current.categorizeError;
    const firstGetMessage = result.current.getUserFriendlyErrorMessage;
    const firstWithRetry = result.current.withRetry;

    // Re-render
    rerender({ operation: 'test' });

    // Utility functions should always be stable (they're not hooks)
    expect(result.current.categorizeError).toBe(firstCategorize);
    expect(result.current.getUserFriendlyErrorMessage).toBe(firstGetMessage);
    expect(result.current.withRetry).toBe(firstWithRetry);
  });

  it('should not cause re-renders in consuming components', async () => {
    let renderCount = 0;

    // Track render count using a hook-based approach
    const useTestHook = (operation: string) => {
      renderCount++;
      const { executeWithErrorHandling } = useErrorHandling(operation);

      // This should not trigger re-renders
      React.useEffect(() => {
        const testAsync = async () => {
          await executeWithErrorHandling(
            async () => 'test',
            undefined,
            { maxAttempts: 1 }
          );
        };
        testAsync();
      }, [executeWithErrorHandling]);

      return { executeWithErrorHandling };
    };

    const { rerender } = renderHook(
      ({ operation }) => useTestHook(operation),
      {
        initialProps: { operation: 'test' },
      }
    );

    // Re-render with same props multiple times
    rerender({ operation: 'test' });
    rerender({ operation: 'test' });
    rerender({ operation: 'test' });

    // Should only render once per prop change (not infinitely)
    // Initial render + 3 re-renders = 4 total
    // Without fix, this would be much higher due to infinite loop
    expect(renderCount).toBeLessThanOrEqual(5); // Allow some flexibility for React internals
  });
});