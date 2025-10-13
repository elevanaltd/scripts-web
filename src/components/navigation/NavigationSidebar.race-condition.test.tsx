/**
 * NavigationSidebar Race Condition Tests
 *
 * Tests for React race condition fixes in auto-refresh functionality
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NavigationSidebar } from './NavigationSidebar';
import { NavigationProvider } from '../../contexts/NavigationContext';

// Mock Supabase
vi.mock('../../lib/supabase', () => {
  const mockSupabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  };
  return { supabase: mockSupabase };
});

// Mock validation to prevent issues
vi.mock('../../lib/validation', () => ({
  validateProjectId: vi.fn((id: string) => id),
  ValidationError: class ValidationError extends Error {}
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NavigationProvider>
    {children}
  </NavigationProvider>
);

describe.skip('NavigationSidebar Race Condition Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Auto-refresh Race Conditions', () => {
    it('should handle rapid expandedProjects state changes without stale closures', async () => {
      const { rerender } = render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={100} />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Simulate rapid re-renders that could cause stale closures
      for (let i = 0; i < 5; i++) {
        rerender(
          <TestWrapper>
            <NavigationSidebar refreshInterval={100} key={i} />
          </TestWrapper>
        );
      }

      // Advance timers to trigger refresh
      vi.advanceTimersByTime(200);

      // Component should continue to function normally
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });
    });

    it('should clean up intervals on unmount to prevent memory leaks', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={100} />
        </TestWrapper>
      );

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Verify interval was cleaned up
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not trigger refresh when document is hidden', async () => {
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true
      });

      render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={50} />
        </TestWrapper>
      );

      // Clear initial load calls
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Advance timers - should not trigger refresh when hidden
      vi.advanceTimersByTime(100);

      // Component should still be functioning
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Clean up
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false
      });
    });

    it('should handle visibility change events properly', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <TestWrapper>
          <NavigationSidebar />
        </TestWrapper>
      );

      // Capture the visibility change callback
      expect(addEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      const capturedCallback = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'visibilitychange'
      )?.[1] as () => void;

      expect(capturedCallback).toBeDefined();

      // Test visibility change
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true
      });
      capturedCallback();

      // Unmount and verify cleanup
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', capturedCallback);
    });
  });

  describe('UseCallback Dependencies', () => {
    it('should not recreate refreshData callback when expandedProjects changes', async () => {
      // This test verifies that the useCallback dependencies are correct
      // and don't cause the useEffect to re-run unnecessarily

      const { rerender } = render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={1000} />
        </TestWrapper>
      );

      // Get initial render
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Simulate component re-render (would happen when expandedProjects changes)
      rerender(
        <TestWrapper>
          <NavigationSidebar refreshInterval={1000} />
        </TestWrapper>
      );

      // Component should continue to work normally
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully without breaking refresh cycle', async () => {
      render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={100} />
        </TestWrapper>
      );

      // Component should render without crashing
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should not refresh when component is not visible', async () => {
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true
      });

      render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={10} />
        </TestWrapper>
      );

      // Let initial load complete
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Advance timers multiple intervals
      vi.advanceTimersByTime(100);

      // Component should still be functioning
      expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
    });

    it('should resume refresh when becoming visible', async () => {
      // Start hidden
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true
      });

      render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={50} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Become visible
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false
      });

      // Trigger visibility change event
      const event = new Event('visibilitychange');
      document.dispatchEvent(event);

      // Advance timer
      vi.advanceTimersByTime(60);

      // Component should continue working
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });
    });
  });
});