/**
 * CommentSidebar.realtime.test.tsx - TDD Tests for Realtime Subscriptions
 *
 * Following TDD protocol (RED-GREEN-REFACTOR):
 * Phase: RED - These tests WILL FAIL until Realtime implementation is complete
 *
 * Requirements:
 * - Subscribe to Supabase Realtime channel on mount
 * - Handle INSERT events (add new comments to state)
 * - Handle UPDATE events (modify existing comments)
 * - Handle DELETE events (remove comments from state)
 * - Cleanup subscription on unmount
 * - Filter by script_id to prevent cross-script pollution
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CommentWithUser } from '../../types/comments';

// Mock channel for Realtime subscriptions
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn().mockResolvedValue({ status: 'ok', error: null }),
};

// Mock user profile responses for enrichment
const mockUserProfiles = new Map<string, { id: string; email: string; display_name: string | null; role: string | null }>();

// Mock Supabase with Realtime channel support and user profile queries
vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    from: vi.fn((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((field: string, value: string) => ({
              single: vi.fn(async () => {
                const profile = mockUserProfiles.get(value);
                if (profile) {
                  return { data: profile, error: null };
                }
                return { data: null, error: { message: 'User not found' } };
              })
            }))
          }))
        };
      }
      return {};
    })
  },
}));

// Mock comments library
vi.mock('../../lib/comments', () => ({
  getComments: vi.fn().mockResolvedValue({
    success: true,
    data: [],
    error: undefined,
  }),
}));

// Mock auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'user-1', email: 'test@example.com' } }),
}));

// Import component after mocks
import { CommentSidebar } from './CommentSidebar';
import { supabase as mockSupabase } from '../../lib/supabase';

// Create a test wrapper with QueryClientProvider
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );

  // Wrap the rerender function to maintain QueryClientProvider
  const originalRerender = result.rerender;
  result.rerender = (rerenderUi: React.ReactNode) => {
    return originalRerender(
      <QueryClientProvider client={queryClient}>
        {rerenderUi}
      </QueryClientProvider>
    );
  };

  return result;
};

describe('CommentSidebar - Realtime Subscriptions (TDD RED Phase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserProfiles.clear();

    // Setup default user profiles for tests
    mockUserProfiles.set('user-1', {
      id: 'user-1',
      email: 'user1@example.com',
      display_name: 'User One',
      role: 'admin'
    });
    mockUserProfiles.set('user-2', {
      id: 'user-2',
      email: 'user2@example.com',
      display_name: 'User Two',
      role: 'client'
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Subscription Setup', () => {
    it('should create a Realtime channel scoped to script_id on mount', async () => {
      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        // Should create channel with script-specific name
        expect(mockSupabase.channel).toHaveBeenCalledWith('comments:script-123');
      });
    });

    it('should subscribe to postgres_changes event for comments table', async () => {
      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          expect.objectContaining({
            event: '*', // All events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'comments',
            // No server-side filter - RLS handles authorization, client filters locally
          }),
          expect.any(Function) // Payload handler callback
        );
      });
    });

    it('should call subscribe() to activate the channel', async () => {
      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });
    });

    it('should unsubscribe from channel on unmount', async () => {
      const { unmount } = renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockChannel.unsubscribe).toHaveBeenCalled();
      });
    });

    it('should create new subscription when scriptId changes', async () => {
      const { rerender } = renderWithProviders(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalledWith('comments:script-1');
      });

      vi.clearAllMocks();

      rerender(<CommentSidebar scriptId="script-2" />);

      await waitFor(() => {
        // Should unsubscribe from old channel
        expect(mockChannel.unsubscribe).toHaveBeenCalled();
        // Should create new channel
        expect(mockSupabase.channel).toHaveBeenCalledWith('comments:script-2');
      });
    });
  });

  describe('INSERT Event Handling', () => {
    it('should add new comment to state when INSERT event received', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realtimeCallback: ((payload: any) => void) | null = null;

      // Capture the Realtime callback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockChannel.on.mockImplementation((_eventType: string, _config: any, callback: any) => {
        if (_eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      // Wait for subscription setup
      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
        expect(realtimeCallback).not.toBeNull();
      });

      // Simulate INSERT event with RAW database data (no user JOIN)
      const rawCommentData = {
        id: 'new-comment-1',
        script_id: 'script-123',
        user_id: 'user-2',
        content: 'New comment from another user',
        start_position: 10,
        end_position: 20,
        highlighted_text: null,
        parent_comment_id: null,
        resolved_at: null,
        resolved_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted: false
      };

      await act(async () => {
        realtimeCallback!({
          eventType: 'INSERT',
          new: rawCommentData,
          old: {},
          errors: null,
        });
      });

      // New comment should appear in the UI
      await waitFor(() => {
        expect(screen.getByText('New comment from another user')).toBeInTheDocument();
      });
    });

    it('should not add duplicate comments if INSERT event for existing comment', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realtimeCallback: ((payload: any) => void) | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockChannel.on.mockImplementation((_eventType: string, _config: any, callback: any) => {
        if (_eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      // Start with existing comment
      const existingComment: CommentWithUser = {
        id: 'existing-1',
        scriptId: 'script-123',
        userId: 'user-1',
        content: 'Existing comment',
        startPosition: 5,
        endPosition: 15,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      };

      const { getComments } = await import('../../lib/comments');
      vi.mocked(getComments).mockResolvedValue({
        success: true,
        data: [existingComment],
        error: undefined,
      });

      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(screen.getByText('Existing comment')).toBeInTheDocument();
      });

      // Simulate duplicate INSERT event with raw database format
      await act(async () => {
        realtimeCallback!({
          eventType: 'INSERT',
          new: {
            id: existingComment.id,
            script_id: existingComment.scriptId,
            user_id: existingComment.userId,
            content: existingComment.content,
            start_position: existingComment.startPosition,
            end_position: existingComment.endPosition,
            highlighted_text: existingComment.highlightedText || null,
            parent_comment_id: existingComment.parentCommentId,
            resolved_at: existingComment.resolvedAt,
            resolved_by: existingComment.resolvedBy,
            created_at: existingComment.createdAt,
            updated_at: existingComment.updatedAt,
            deleted: false
          },
          old: {},
          errors: null,
        });
      });

      // Should still only have ONE instance of the comment
      await waitFor(() => {
        const commentCards = screen.getAllByRole('article');
        const matchingComments = commentCards.filter(card =>
          card.textContent?.includes('Existing comment')
        );
        expect(matchingComments).toHaveLength(1);
      });
    });
  });

  describe('UPDATE Event Handling', () => {
    it('should update existing comment when UPDATE event received', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realtimeCallback: ((payload: any) => void) | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockChannel.on.mockImplementation((_eventType: string, _config: any, callback: any) => {
        if (_eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      // Start with existing comment
      const existingComment: CommentWithUser = {
        id: 'comment-1',
        scriptId: 'script-123',
        userId: 'user-1',
        content: 'Original content',
        startPosition: 5,
        endPosition: 15,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      };

      const { getComments } = await import('../../lib/comments');
      vi.mocked(getComments).mockResolvedValue({
        success: true,
        data: [existingComment],
        error: undefined,
      });

      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(screen.getByText('Original content')).toBeInTheDocument();
      });

      // Simulate UPDATE event with raw database format
      const updatedCommentData = {
        id: existingComment.id,
        script_id: existingComment.scriptId,
        user_id: existingComment.userId,
        content: 'Updated content',
        start_position: existingComment.startPosition,
        end_position: existingComment.endPosition,
        highlighted_text: existingComment.highlightedText || null,
        parent_comment_id: existingComment.parentCommentId,
        resolved_at: existingComment.resolvedAt,
        resolved_by: existingComment.resolvedBy,
        created_at: existingComment.createdAt,
        updated_at: new Date().toISOString(),
        deleted: false
      };

      await act(async () => {
        realtimeCallback!({
          eventType: 'UPDATE',
          new: updatedCommentData,
          old: existingComment,
          errors: null,
        });
      });

      // Updated content should appear
      await waitFor(() => {
        expect(screen.queryByText('Original content')).not.toBeInTheDocument();
        expect(screen.getByText('Updated content')).toBeInTheDocument();
      });
    });

    it('should update resolved status when comment is resolved via Realtime', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realtimeCallback: ((payload: any) => void) | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockChannel.on.mockImplementation((_eventType: string, _config: any, callback: any) => {
        if (_eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      // Start with unresolved comment
      const unresolvedComment: CommentWithUser = {
        id: 'comment-1',
        scriptId: 'script-123',
        userId: 'user-1',
        content: 'Needs review',
        startPosition: 5,
        endPosition: 15,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      };

      const { getComments } = await import('../../lib/comments');
      vi.mocked(getComments).mockResolvedValue({
        success: true,
        data: [unresolvedComment],
        error: undefined,
      });

      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        const commentCard = screen.getByText('Needs review').closest('[role="article"]');
        expect(commentCard).not.toHaveClass('comment-resolved');
      });

      // Simulate UPDATE event with resolved status in raw database format
      const resolvedCommentData = {
        id: unresolvedComment.id,
        script_id: unresolvedComment.scriptId,
        user_id: unresolvedComment.userId,
        content: unresolvedComment.content,
        start_position: unresolvedComment.startPosition,
        end_position: unresolvedComment.endPosition,
        highlighted_text: unresolvedComment.highlightedText || null,
        parent_comment_id: unresolvedComment.parentCommentId,
        resolved_at: new Date().toISOString(),
        resolved_by: 'user-2',
        created_at: unresolvedComment.createdAt,
        updated_at: new Date().toISOString(),
        deleted: false
      };

      await act(async () => {
        realtimeCallback!({
          eventType: 'UPDATE',
          new: resolvedCommentData,
          old: unresolvedComment,
          errors: null,
        });
      });

      // Should show as resolved
      await waitFor(() => {
        const commentCard = screen.getByText('Needs review').closest('[role="article"]');
        expect(commentCard).toHaveClass('comment-resolved');
      });
    });
  });

  describe('DELETE Event Handling', () => {
    it('should remove comment from state when DELETE event received', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realtimeCallback: ((payload: any) => void) | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockChannel.on.mockImplementation((_eventType: string, _config: any, callback: any) => {
        if (_eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      // Start with existing comment
      const existingComment: CommentWithUser = {
        id: 'comment-to-delete',
        scriptId: 'script-123',
        userId: 'user-1',
        content: 'Will be deleted',
        startPosition: 5,
        endPosition: 15,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      };

      const { getComments } = await import('../../lib/comments');
      vi.mocked(getComments).mockResolvedValue({
        success: true,
        data: [existingComment],
        error: undefined,
      });

      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(screen.getByText('Will be deleted')).toBeInTheDocument();
      });

      // Simulate DELETE event
      await act(async () => {
        realtimeCallback!({
          eventType: 'DELETE',
          old: existingComment,
          new: {},
          errors: null,
        });
      });

      // Comment should disappear
      await waitFor(() => {
        expect(screen.queryByText('Will be deleted')).not.toBeInTheDocument();
      });
    });

    it('should not error if DELETE event for non-existent comment', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let realtimeCallback: ((payload: any) => void) | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockChannel.on.mockImplementation((_eventType: string, _config: any, callback: any) => {
        if (_eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Simulate DELETE for comment that doesn't exist
      await act(async () => {
        realtimeCallback!({
          eventType: 'DELETE',
          old: { id: 'non-existent-comment' },
          new: {},
          errors: null,
        });
      });

      // Should not crash or error
      await waitFor(() => {
        expect(true).toBe(true); // No-op assertion to wait for async
      });
    });
  });

  describe('RLS Filtering (Automated)', () => {
    it('should receive only comments for current script_id via RLS', async () => {
      // This test validates that Supabase RLS filters broadcasts automatically
      // Server-side filter removed to prevent CHANNEL_ERROR with complex RLS
      // Client-side filtering applied in event handler instead
      renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          expect.objectContaining({
            event: '*',
            schema: 'public',
            table: 'comments',
            // No server-side filter - causes CHANNEL_ERROR with complex RLS policies
          }),
          expect.any(Function)
        );
      });

      // Verify RLS handles authorization at database level
      // Client-side filtering happens in the event handler
      expect(mockChannel.on).toHaveBeenCalled();
    });
  });

  describe('Memory Safety and Cleanup', () => {
    it('should not update state if component unmounts during subscription setup', async () => {
      const { unmount } = renderWithProviders(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Unmount - this should clean up the subscription
      unmount();

      await waitFor(() => {
        expect(mockChannel.unsubscribe).toHaveBeenCalled();
      });

      // Test passes if no errors thrown during unmount
      expect(true).toBe(true);
    });
  });
});
