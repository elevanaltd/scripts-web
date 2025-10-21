/**
 * CommentSidebar.connection-state.test.tsx - Connection State Machine Tests
 *
 * RED PHASE: Testing connection state transitions for resilient realtime handling
 * - connected → reconnecting → degraded state transitions
 * - UI preserves comments during reconnection (non-destructive)
 * - Action buttons disabled when connectionStatus !== 'connected'
 * - Status banner visibility based on connection state
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// Mock channel for Realtime subscriptions
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn().mockResolvedValue({ status: 'ok', error: null }),
};

// Mock Supabase with Realtime channel support
vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    from: vi.fn(() => ({})),
  },
}));

// Mock comments library
vi.mock('../../lib/comments', () => ({
  getComments: vi.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
  createComment: vi.fn(),
  resolveComment: vi.fn(),
  unresolveComment: vi.fn(),
  deleteComment: vi.fn(),
  updateComment: vi.fn(),
  clearUserProfileCache: vi.fn(),
}));

// Mock Logger
vi.mock('../../services/logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'user-1', email: 'test@example.com' } }),
}));

// Import component after mocks
import { CommentSidebar } from './CommentSidebar';
import * as commentsLib from '../../lib/comments';

describe.skip('CommentSidebar - Connection State Machine', () => {
  let subscribeCallback: (status: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock channel with subscribe callback capture
    mockChannel.subscribe = vi.fn((callback) => {
      subscribeCallback = callback;
      // Synchronously trigger SUBSCRIBED to set connected state
      // (setTimeout doesn't work with fake timers in tests)
      queueMicrotask(() => callback('SUBSCRIBED'));
      return mockChannel;
    });

    // Mock initial comments load
    vi.mocked(commentsLib.getComments).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'comment-1',
          scriptId: 'script-123',
          userId: 'user-1',
          content: 'Test comment',
          startPosition: 0,
          endPosition: 10,
          highlightedText: 'test',
          parentCommentId: null,
          resolvedAt: null,
          resolvedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: {
            id: 'user-1',
            email: 'test@example.com',
            displayName: 'Test User',
            role: 'admin',
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Connection State Transitions', () => {
    it('should transition from connected → reconnecting on TIMED_OUT', async () => {
      render(<CommentSidebar scriptId="script-123" />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Verify initially connected (no banner)
      expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument();

      // Simulate TIMED_OUT event
      act(() => {
        subscribeCallback('TIMED_OUT');
      });

      // Should show reconnecting banner
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });
    });

    it('should transition from connected → reconnecting on CHANNEL_ERROR', async () => {
      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Simulate CHANNEL_ERROR event
      act(() => {
        subscribeCallback('CHANNEL_ERROR');
      });

      // Should show reconnecting banner
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });
    });

    it('should transition from reconnecting → connected on successful reconnect', async () => {
      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Go to reconnecting state
      act(() => {
        subscribeCallback('TIMED_OUT');
      });
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });

      // Successful reconnection
      act(() => {
        subscribeCallback('SUBSCRIBED');
      });

      // Should hide reconnecting banner
      await waitFor(() => {
        expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument();
      });
    });

    it('should transition to degraded after 4 failed reconnection attempts', async () => {
      vi.useFakeTimers();

      render(
        
          <CommentSidebar scriptId="script-123" />
        
      );

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Simulate 4 consecutive timeouts
      for (let i = 0; i < 4; i++) {
        act(() => {
          subscribeCallback('TIMED_OUT');
          // Fast-forward past reconnection delay
          vi.advanceTimersByTime(10000);
        });
      }

      // Should show degraded state banner
      await waitFor(() => {
        expect(screen.getByText(/connection degraded/i)).toBeInTheDocument();
      }, { timeout: 1000 });

      vi.useRealTimers();
    });
  });

  describe('UI Preservation During Reconnection', () => {
    it('should preserve comments UI during reconnecting state', async () => {
      render(
        
          <CommentSidebar scriptId="script-123" />
        
      );

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Trigger reconnecting state
      act(() => {
        subscribeCallback('TIMED_OUT');
      });

      // Comments should still be visible
      expect(screen.getByText('Test comment')).toBeInTheDocument();

      // Should show banner but not replace UI
      expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    });

    it('should NOT show destructive error state during reconnection', async () => {
      render(
        
          <CommentSidebar scriptId="script-123" />
        
      );

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Trigger reconnecting state
      act(() => {
        subscribeCallback('CHANNEL_ERROR');
      });

      // Should NOT show error state (no error message replacing comments)
      expect(screen.queryByText(/failed to load comments/i)).not.toBeInTheDocument();

      // Comments should remain visible
      expect(screen.getByText('Test comment')).toBeInTheDocument();
    });
  });

  describe('Action Button State Management', () => {
    it('should disable action buttons when connectionStatus !== "connected"', async () => {
      const { container } = render(
        
          <CommentSidebar
            scriptId="script-123"
            createComment={{
              startPosition: 0,
              endPosition: 10,
              selectedText: 'test',
            }}
          />
        
      );

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Find submit button (initially enabled)
      const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(submitButton).toBeInTheDocument();
      expect(submitButton?.disabled).toBe(false);

      // Trigger reconnecting state
      act(() => {
        subscribeCallback('TIMED_OUT');
      });

      // Submit button should be disabled
      await waitFor(() => {
        expect(submitButton?.disabled).toBe(true);
      });
    });

    it('should re-enable action buttons when returning to connected state', async () => {
      const { container } = render(
        
          <CommentSidebar
            scriptId="script-123"
            createComment={{
              startPosition: 0,
              endPosition: 10,
              selectedText: 'test',
            }}
          />
        
      );

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

      // Go to reconnecting (disabled)
      act(() => {
        subscribeCallback('TIMED_OUT');
      });
      await waitFor(() => {
        expect(submitButton?.disabled).toBe(true);
      });

      // Return to connected (enabled)
      act(() => {
        subscribeCallback('SUBSCRIBED');
      });
      await waitFor(() => {
        expect(submitButton?.disabled).toBe(false);
      });
    });
  });

  describe('Status Banner Visibility', () => {
    it('should show "Reconnecting..." banner when connectionStatus is "reconnecting"', async () => {
      render(
        
          <CommentSidebar scriptId="script-123" />
        
      );

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      act(() => {
        subscribeCallback('TIMED_OUT');
      });

      // Banner should be visible
      await waitFor(() => {
        const banner = screen.getByText(/reconnecting/i);
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveClass('connection-status-banner'); // or appropriate class
      });
    });

    it('should show "Connection degraded" banner when connectionStatus is "degraded"', async () => {
      vi.useFakeTimers();

      render(
        
          <CommentSidebar scriptId="script-123" />
        
      );

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Trigger degraded state (4 failed attempts)
      for (let i = 0; i < 4; i++) {
        act(() => {
          subscribeCallback('TIMED_OUT');
          vi.advanceTimersByTime(10000);
        });
      }

      await waitFor(() => {
        const banner = screen.getByText(/connection degraded/i);
        expect(banner).toBeInTheDocument();
      }, { timeout: 1000 });

      vi.useRealTimers();
    });

    it('should hide banner when connectionStatus is "connected"', async () => {
      render(
        
          <CommentSidebar scriptId="script-123" />
        
      );

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Go to reconnecting
      act(() => {
        subscribeCallback('TIMED_OUT');
      });
      await waitFor(() => {
        expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
      });

      // Return to connected
      act(() => {
        subscribeCallback('SUBSCRIBED');
      });

      // Banner should be hidden
      await waitFor(() => {
        expect(screen.queryByText(/reconnecting/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/connection degraded/i)).not.toBeInTheDocument();
      });
    });
  });
});
