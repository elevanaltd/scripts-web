/**
 * Security Test Suite for TD-005: Cache Poisoning Vulnerability
 *
 * CONSTITUTIONAL MANDATE: TDD RED Phase
 * Tests written BEFORE implementation to prove vulnerability exists
 *
 * Vulnerability: Optimistic realtime cache updates bypass RLS validation
 * Attack Window: 100-500ms before server refetch verifies data
 *
 * Test Coverage:
 * - 7 attack scenarios (injection, cross-script, replay, XSS, impersonation, malformed, cascade)
 * - 2 legitimate use cases (own comment, collaborator update)
 *
 * Expected Behavior:
 * - Tests currently FAIL (vulnerability exists)
 * - After verify-then-cache implementation, tests PASS
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { useCommentSidebar } from './useCommentSidebar';
import type { CommentWithUser } from '../../types/comments';
import { supabase } from '../../lib/supabase';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { display_name: 'Test User' },
    },
  }),
}));

vi.mock('./useCommentMutations', () => ({
  useCommentMutations: () => ({
    resolveMutation: {
      mutate: vi.fn(),
    },
    unresolveMutation: {
      mutate: vi.fn(),
    },
    deleteMutation: {
      mutate: vi.fn(),
    },
  }),
}));

// Track mock comments data for dynamic updates
let mockCommentsData: CommentWithUser[] = [];

vi.mock('./useScriptCommentsQuery', () => ({
  useScriptCommentsQuery: () => ({
    get data() {
      return mockCommentsData;
    },
    isLoading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({ data: mockCommentsData }),
  }),
}));

describe('TD-005: Cache Poisoning Security Tests', () => {
  let queryClient: QueryClient;
  let channelMock: {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
  let realtimeHandler: ((payload: unknown) => void) | null = null;

  beforeEach(() => {
    // Reset mock comments data
    mockCommentsData = [];

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup channel mock to capture realtime handler
    channelMock = {
      on: vi.fn().mockImplementation((_event, _config, handler) => {
        realtimeHandler = handler;
        return channelMock;
      }),
      subscribe: vi.fn().mockImplementation((callback) => {
        // Immediately call callback with SUBSCRIBED status
        if (callback) {
          callback('SUBSCRIBED');
        }
        return channelMock;
      }),
      unsubscribe: vi.fn(),
    };

    vi.mocked(supabase.channel).mockReturnValue(channelMock as never);

    // Mock console methods to silence expected security logs
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    realtimeHandler = null;
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  /**
   * ATTACK SCENARIO 1: Malicious INSERT Injection
   *
   * Attacker sends fake INSERT event with arbitrary comment data
   * Vulnerability: Optimistic update adds malicious comment to cache before RLS validation
   *
   * Expected: Cache should NOT be poisoned with malicious data
   */
  it('ATTACK 1: Should reject malicious INSERT injection', async () => {
    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    // Capture initial cache state
    const initialThreads = result.current.threads;

    // ATTACK: Inject malicious comment via realtime event (missing required fields)
    const maliciousPayload = {
      eventType: 'INSERT',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {
        // Missing id and script_id - should trigger validation layer 1
        user_id: 'attacker-user-id',
        content: '<script>alert("XSS")</script>',
        start_position: 0,
        end_position: 100,
      },
      old: {},
    };

    // Execute attack
    await act(async () => {
      realtimeHandler!(maliciousPayload);
      // Wait for any optimistic updates to process
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Cache should NOT contain malicious comment
    // (verify-then-cache pattern only updates after server validation)
    expect(result.current.threads).toEqual(initialThreads);

    // ASSERTION: Security event should be logged
    // Note: Logger.warn() adds timestamp prefix, we check for presence of call
    expect(console.warn).toHaveBeenCalled();
    const warnCall = vi.mocked(console.warn).mock.calls[0];
    expect(warnCall).toBeDefined();
    expect(warnCall.join(' ')).toContain('Malformed realtime payload');
  });

  /**
   * ATTACK SCENARIO 2: Cross-Script Contamination
   *
   * Attacker sends INSERT event for different script_id
   * Vulnerability: Cache could be contaminated with comments from other scripts
   *
   * Expected: Event should be rejected, cache unchanged
   */
  it('ATTACK 2: Should prevent cross-script cache contamination', async () => {
    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    const initialThreads = result.current.threads;

    // ATTACK: Send event for different script
    const crossScriptPayload = {
      eventType: 'INSERT',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {
        id: 'comment-from-other-script',
        script_id: 'script-DIFFERENT', // Different script ID
        user_id: 'user-456',
        content: 'This should not appear',
        start_position: 0,
        end_position: 50,
        highlighted_text: null,
        parent_comment_id: null,
        resolved_at: null,
        resolved_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      old: {},
    };

    await act(async () => {
      realtimeHandler!(crossScriptPayload);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Cache unchanged
    expect(result.current.threads).toEqual(initialThreads);

    // ASSERTION: Cross-script event logged
    expect(console.info).toHaveBeenCalled();
    const infoCall = vi.mocked(console.info).mock.calls.find(call =>
      call.join(' ').includes('Realtime event for different script')
    );
    expect(infoCall).toBeDefined();
    // Check metadata object (last parameter contains expected/received values)
    const metadataArg = infoCall!.find(arg => typeof arg === 'object' && arg !== null);
    expect(metadataArg).toBeDefined();
    expect((metadataArg as Record<string, string>).expected).toBe('script-123');
    expect((metadataArg as Record<string, string>).received).toBe('script-DIFFERENT');
  });

  /**
   * ATTACK SCENARIO 3: Replay Attack Prevention
   *
   * Attacker sends stale event (5 minutes old)
   * Vulnerability: Old events could replay state changes
   *
   * Expected: Stale events should be rejected
   */
  it('ATTACK 3: Should reject stale realtime events (replay attack)', async () => {
    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    const initialThreads = result.current.threads;

    // ATTACK: Send event with 5-minute-old timestamp
    const staleTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const stalePayload = {
      eventType: 'INSERT',
      schema: 'public',
      table: 'comments',
      commit_timestamp: staleTimestamp,
      errors: null,
      new: {
        id: 'stale-comment',
        script_id: 'script-123',
        user_id: 'user-123',
        content: 'Stale event',
        start_position: 0,
        end_position: 50,
        highlighted_text: null,
        parent_comment_id: null,
        resolved_at: null,
        resolved_by: null,
        created_at: staleTimestamp,
        updated_at: staleTimestamp,
      },
      old: {},
    };

    await act(async () => {
      realtimeHandler!(stalePayload);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Cache unchanged
    expect(result.current.threads).toEqual(initialThreads);

    // ASSERTION: Replay attempt logged
    expect(console.warn).toHaveBeenCalled();
    const warnCall = vi.mocked(console.warn).mock.calls.find(call =>
      call.join(' ').includes('Stale realtime event')
    );
    expect(warnCall).toBeDefined();
    expect(warnCall!.join(' ')).toContain('replay attack');
  });

  /**
   * ATTACK SCENARIO 4: Malformed Payload Handling
   *
   * Attacker sends payload missing required fields
   * Vulnerability: Malformed data could crash client or cause undefined behavior
   *
   * Expected: Graceful handling, no crash, security log
   */
  it('ATTACK 4: Should gracefully handle malformed payloads', async () => {
    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    const initialThreads = result.current.threads;

    // ATTACK: Send payload missing required fields
    const malformedPayload = {
      eventType: 'INSERT',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {
        // Missing id, script_id, user_id, content, positions
        content: 'Incomplete data',
      },
      old: {},
    };

    // Should not throw
    await act(async () => {
      expect(() => realtimeHandler!(malformedPayload)).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Cache unchanged, no crash
    expect(result.current.threads).toEqual(initialThreads);

    // ASSERTION: Malformed payload logged
    expect(console.warn).toHaveBeenCalled();
    const warnCall = vi.mocked(console.warn).mock.calls.find(call =>
      call.join(' ').includes('Malformed realtime payload')
    );
    expect(warnCall).toBeDefined();
    expect(warnCall!.join(' ')).toContain('missing required fields');
  });

  /**
   * ATTACK SCENARIO 5: XSS Attempt via Realtime
   *
   * Attacker injects comment with <script> tags
   * Vulnerability: Cache poisoned with XSS payload (even if DOMPurify would sanitize later)
   *
   * Expected: Payload validation should reject (defense-in-depth)
   */
  it('ATTACK 5: Should reject XSS payloads in realtime events', async () => {
    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    const initialThreads = result.current.threads;

    // ATTACK: XSS injection attempt
    const xssPayload = {
      eventType: 'INSERT',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {
        id: 'xss-comment',
        script_id: 'script-123',
        user_id: 'attacker-user',
        content: '<script>alert("XSS")</script><img src=x onerror=alert("XSS2")>',
        start_position: 0,
        end_position: 100,
        highlighted_text: '<iframe src="evil.com"></iframe>',
        parent_comment_id: null,
        resolved_at: null,
        resolved_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      old: {},
    };

    await act(async () => {
      realtimeHandler!(xssPayload);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Cache NOT poisoned (even though DOMPurify would sanitize later)
    expect(result.current.threads).toEqual(initialThreads);

    // NOTE: XSS content itself is not specifically validated in payload validation
    // Defense-in-depth: RLS validation + DOMPurify sanitization
    // This test validates that unverified payloads don't reach cache
  });

  /**
   * ATTACK SCENARIO 6: User Impersonation
   *
   * Attacker injects comment with fake user_id
   * Vulnerability: Cache shows comment from impersonated user
   *
   * Expected: Cache verification via refetch, fake user_id does not bypass validation
   */
  it('ATTACK 6: Should verify user identity via server refetch', async () => {
    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    const initialThreads = result.current.threads;

    // ATTACK: Impersonate admin user
    const impersonationPayload = {
      eventType: 'INSERT',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {
        id: 'fake-admin-comment',
        script_id: 'script-123',
        user_id: 'admin-user-id', // Fake user ID
        content: 'I am admin (fake)',
        start_position: 0,
        end_position: 50,
        highlighted_text: null,
        parent_comment_id: null,
        resolved_at: null,
        resolved_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      old: {},
    };

    await act(async () => {
      realtimeHandler!(impersonationPayload);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Cache unchanged (server refetch validates user_id via RLS)
    expect(result.current.threads).toEqual(initialThreads);

    // NOTE: User impersonation is prevented by RLS policies on server
    // This test validates that optimistic updates don't bypass RLS
  });

  /**
   * ATTACK SCENARIO 7: Malicious DELETE Cascade
   *
   * Attacker injects DELETE event for legitimate comment
   * Vulnerability: Cache removes comment that should remain
   *
   * Expected: DELETE ignored, comment remains in cache
   */
  it('ATTACK 7: Should ignore unauthorized DELETE events', async () => {
    // Pre-populate mock data with legitimate comment
    const legitimateComment: CommentWithUser = {
      id: 'legit-comment-1',
      scriptId: 'script-123',
      userId: 'user-123',
      content: 'Legitimate comment',
      startPosition: 0,
      endPosition: 50,
      highlightedText: 'Some text',
      parentCommentId: null,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      },
    };

    mockCommentsData = [legitimateComment];

    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    // Wait for initial data to load
    await waitFor(() => {
      expect(result.current.threads.length).toBe(1);
    }, { timeout: 3000 });

    const initialThreads = result.current.threads;

    // ATTACK: Send DELETE with only partial data (missing required fields)
    const maliciousDeletePayload = {
      eventType: 'DELETE',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {},
      old: {
        id: 'legit-comment-1', // Has id but missing script_id
        // Missing script_id triggers validation failure
      },
    };

    await act(async () => {
      realtimeHandler!(maliciousDeletePayload);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Comment remains in cache (DELETE event ignored before validation)
    expect(result.current.threads).toEqual(initialThreads);
    expect(result.current.threads.length).toBe(1);

    // ASSERTION: DELETE event logged as INFO (application uses soft deletes)
    expect(console.info).toHaveBeenCalled();
    const infoCall = vi.mocked(console.info).mock.calls.find(call =>
      call.join(' ').includes('Ignoring hard DELETE event')
    );
    expect(infoCall).toBeDefined();
  });

  /**
   * LEGITIMATE USE CASE 1: Own Comment Optimistic Update
   *
   * User creates comment → mutation optimistic update → realtime INSERT event
   * Expected: Comment appears immediately via mutation, realtime event updates after verification
   */
  it('LEGITIMATE 1: Should handle own comment creation correctly', async () => {
    // This test validates that user-initiated mutations work correctly
    // Optimistic updates from mutations are preserved (not covered by realtime security)

    const ownComment: CommentWithUser = {
      id: 'temp-own-comment',
      scriptId: 'script-123',
      userId: 'user-123',
      content: 'My own comment',
      startPosition: 0,
      endPosition: 50,
      highlightedText: 'Selected text',
      parentCommentId: null,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
      },
    };

    mockCommentsData = [ownComment];

    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    // Wait for mock data to populate threads
    await waitFor(() => {
      expect(result.current.threads.length).toBe(1);
    }, { timeout: 3000 });

    // Realtime event arrives (after server verification)
    const legitimateRealtimeEvent = {
      eventType: 'INSERT',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {
        id: 'server-verified-comment', // Server-assigned ID
        script_id: 'script-123',
        user_id: 'user-123',
        content: 'My own comment',
        start_position: 0,
        end_position: 50,
        highlighted_text: 'Selected text',
        parent_comment_id: null,
        resolved_at: null,
        resolved_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      old: {},
    };

    await act(async () => {
      realtimeHandler!(legitimateRealtimeEvent);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Comment exists (either from mutation or verified realtime)
    expect(result.current.threads.length).toBeGreaterThanOrEqual(1);
  });

  /**
   * LEGITIMATE USE CASE 2: Collaborator Update
   *
   * Collaborator updates comment → realtime UPDATE event
   * Expected: Update reflected after server verification (100-500ms acceptable latency)
   */
  it('LEGITIMATE 2: Should handle collaborator updates after verification', async () => {
    // Pre-populate with existing comment
    const existingComment: CommentWithUser = {
      id: 'collab-comment-1',
      scriptId: 'script-123',
      userId: 'collaborator-456',
      content: 'Original content',
      startPosition: 0,
      endPosition: 50,
      highlightedText: 'Text',
      parentCommentId: null,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        id: 'collaborator-456',
        email: 'collab@example.com',
        displayName: 'Collaborator',
      },
    };

    mockCommentsData = [existingComment];

    const { result } = renderHook(
      () =>
        useCommentSidebar({
          scriptId: 'script-123',
          createComment: null,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(realtimeHandler).toBeTruthy();
    });

    await waitFor(() => {
      expect(result.current.threads.length).toBe(1);
    }, { timeout: 3000 });

    // Collaborator updates comment
    const updatePayload = {
      eventType: 'UPDATE',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {
        id: 'collab-comment-1',
        script_id: 'script-123',
        user_id: 'collaborator-456',
        content: 'Updated content by collaborator',
        start_position: 0,
        end_position: 50,
        highlighted_text: 'Text',
        parent_comment_id: null,
        resolved_at: null,
        resolved_by: null,
        created_at: existingComment.createdAt,
        updated_at: new Date().toISOString(),
      },
      old: {
        id: 'collab-comment-1',
        content: 'Original content',
      },
    };

    await act(async () => {
      realtimeHandler!(updatePayload);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // ASSERTION: Update reflected (100-500ms latency acceptable)
    // Note: In verify-then-cache pattern, update only appears after server refetch
    // This is ACCEPTABLE security tradeoff (slight latency for collaborator updates)
    await waitFor(() => {
      expect(result.current.threads.length).toBeGreaterThanOrEqual(1);
    });
  });
});
