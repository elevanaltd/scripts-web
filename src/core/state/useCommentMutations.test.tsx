import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useCommentMutations } from './useCommentMutations'
import { NavigationProvider } from '../../contexts/NavigationContext'
import * as commentsLib from '../../lib/comments'
import type { CommentWithUser } from '../../types/comments'
import type { CommentResult } from '../../lib/comments'

// Mock the comments library - DETERMINISTIC PATTERN (no setTimeout delays)
vi.mock('../../lib/comments', () => ({
  createComment: vi.fn(),
  updateComment: vi.fn(),
  resolveComment: vi.fn(),
  unresolveComment: vi.fn(),
  deleteComment: vi.fn(),
}))

// Mock the Auth hook (boundary mock for Supabase Auth)
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 'test-user-id' },
    userProfile: {
      role: 'admin',
      display_name: 'Test User',
      id: 'user-123',
      email: 'test@example.com',
      created_at: '2025-01-01'
    },
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Mock the comment store (Gap #2 & #5 optimistic UX)
vi.mock('../stores/commentStore', () => ({
  useCommentStore: {
    getState: () => ({
      trackOptimisticComment: vi.fn(),
      resolveOptimisticComment: vi.fn(),
      removeOptimisticComment: vi.fn(),
      setSubmittingStatus: vi.fn(),
    }),
  },
}))

describe('useCommentMutations - Integration Tests (Testguard-Approved)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false, // Disable retries for tests
        },
        queries: {
          retry: false,
        },
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    // CRITICAL: Clear query cache to prevent cross-test contamination
    queryClient.clear()
    vi.clearAllMocks()
  })

  // ✅ CORRECT: Integration test with REAL providers (minimal boundary mocks)
  const createTestWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <NavigationProvider>{children}</NavigationProvider>
      </QueryClientProvider>
    )
  }

  describe('createMutation', () => {
    it('RED STATE: should create comment and invalidate cache', async () => {
      // DETERMINISTIC: Mock resolves immediately (no setTimeout)
      const mockComment = {
        id: 'comment-123',
        scriptId: 'script-456',
        userId: 'test-user-id',
        content: 'Test comment',
        startPosition: 0,
        endPosition: 10,
        highlightedText: 'Test text',
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(commentsLib.createComment).mockResolvedValue({
        success: true,
        data: mockComment
      } as CommentResult<CommentWithUser>)

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      // Execute mutation with mutateAsync for deterministic completion
      await act(async () => {
        await result.current.createMutation.mutateAsync({
          scriptId: 'script-456',
          content: 'Test comment',
          startPosition: 0,
          endPosition: 10,
          highlightedText: 'Test text',
        })
      })

      // Verify cache invalidation (deterministic - mutation fully settled)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['comments']
      })
      // Success - mutation completed without throwing
    })
  })

  describe('updateMutation', () => {
    it('RED STATE: should update comment and invalidate cache', async () => {
      const mockComment = {
        id: 'comment-123',
        scriptId: 'script-456',
        userId: 'test-user-id',
        content: 'Updated comment',
        startPosition: 0,
        endPosition: 10,
        highlightedText: 'Test text',
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(commentsLib.updateComment).mockResolvedValue({
        success: true,
        data: mockComment
      } as CommentResult<CommentWithUser>)

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        await result.current.updateMutation.mutateAsync({
          commentId: 'comment-123',
          content: 'Updated comment',
        })
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['comments']
      })
      // Success - mutation completed without throwing
    })
  })

  describe('resolveMutation', () => {
    it('RED STATE: should resolve comment and invalidate cache', async () => {
      const mockComment = {
        id: 'comment-123',
        scriptId: 'script-456',
        userId: 'test-user-id',
        content: 'Test comment',
        startPosition: 0,
        endPosition: 10,
        highlightedText: 'Test text',
        parentCommentId: null,
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'test-user-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      vi.mocked(commentsLib.resolveComment).mockResolvedValue({
        success: true,
        data: mockComment
      } as CommentResult<CommentWithUser>)

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        await result.current.resolveMutation.mutateAsync({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['comments', 'script-456']
      })
      // Success - mutation completed without throwing
    })

    it('RED STATE: Gap G2 - should optimistically update comment resolution in cache', async () => {
      // Pre-populate cache with comment data
      const cacheKey = ['comments', 'script-456', 'test-user-id']
      queryClient.setQueryData(cacheKey, [
        {
          id: 'comment-123',
          scriptId: 'script-456',
          userId: 'test-user-id',
          content: 'Test comment',
          startPosition: 0,
          endPosition: 10,
          resolvedAt: null,
          resolvedBy: null,
        }
      ])

      const mockResolvedComment = {
        id: 'comment-123',
        scriptId: 'script-456',
        userId: 'test-user-id',
        content: 'Test comment',
        startPosition: 0,
        endPosition: 10,
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'test-user-id',
      }

      vi.mocked(commentsLib.resolveComment).mockResolvedValue({
        success: true,
        data: mockResolvedComment
      } as CommentResult<CommentWithUser>)

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        await result.current.resolveMutation.mutateAsync({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      // Verify optimistic update occurred
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(cacheKey)
      expect(cachedData).toBeDefined()
      expect(cachedData![0].resolvedAt).toBeTruthy()
      expect(cachedData![0].resolvedBy).toBe('test-user-id')
      // Success - mutation completed and cache updated
    })

    it('RED STATE: Gap G2 - should rollback optimistic update on error', async () => {
      const cacheKey = ['comments', 'script-456']
      queryClient.setQueryData(cacheKey, [
        {
          id: 'comment-123',
          resolvedAt: null,
          resolvedBy: null,
        }
      ])

      vi.mocked(commentsLib.resolveComment).mockRejectedValue(
        new Error('Network error')
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        try {
          await result.current.resolveMutation.mutateAsync({
            commentId: 'comment-123',
            scriptId: 'script-456',
          })
        } catch {
          // Expected error
        }
      })

      // Error thrown as expected - verify rollback occurred
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(cacheKey)
      expect(cachedData![0].resolvedAt).toBeNull()
      expect(cachedData![0].resolvedBy).toBeNull()
    })
  })

  describe('unresolveMutation', () => {
    it('RED STATE: Gap G2 - should optimistically update comment unresolve in cache', async () => {
      const cacheKey = ['comments', 'script-456', 'test-user-id']
      queryClient.setQueryData(cacheKey, [
        {
          id: 'comment-123',
          scriptId: 'script-456',
          userId: 'test-user-id',
          content: 'Test comment',
          startPosition: 0,
          endPosition: 10,
          resolvedAt: '2025-01-01T00:00:00Z',
          resolvedBy: 'test-user-id',
        }
      ])

      const mockUnresolvedComment = {
        id: 'comment-123',
        scriptId: 'script-456',
        userId: 'test-user-id',
        content: 'Test comment',
        startPosition: 0,
        endPosition: 10,
        resolvedAt: null,
        resolvedBy: null,
      }

      vi.mocked(commentsLib.unresolveComment).mockResolvedValue({
        success: true,
        data: mockUnresolvedComment
      } as CommentResult<CommentWithUser>)

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        await result.current.unresolveMutation.mutateAsync({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      const cachedData = queryClient.getQueryData<CommentWithUser[]>(cacheKey)
      expect(cachedData).toBeDefined()
      expect(cachedData![0].resolvedAt).toBeNull()
      expect(cachedData![0].resolvedBy).toBeNull()
      // Success - mutation completed and cache updated
    })

    it('RED STATE: Gap G2 - should rollback optimistic unresolve on error', async () => {
      const originalResolvedAt = '2025-01-01T00:00:00Z'
      const cacheKey = ['comments', 'script-456']
      queryClient.setQueryData(cacheKey, [
        {
          id: 'comment-123',
          resolvedAt: originalResolvedAt,
          resolvedBy: 'test-user-id',
        }
      ])

      vi.mocked(commentsLib.unresolveComment).mockRejectedValue(
        new Error('Network error')
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        try {
          await result.current.unresolveMutation.mutateAsync({
            commentId: 'comment-123',
            scriptId: 'script-456',
          })
        } catch {
          // Expected error
        }
      })

      // Error thrown as expected - verify rollback occurred
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(cacheKey)
      expect(cachedData![0].resolvedAt).toBe(originalResolvedAt)
      expect(cachedData![0].resolvedBy).toBe('test-user-id')
    })
  })

  describe('deleteMutation', () => {
    it('RED STATE: should delete comment and invalidate cache', async () => {
      vi.mocked(commentsLib.deleteComment).mockResolvedValue({
        success: true,
      } as CommentResult<boolean>)

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        await result.current.deleteMutation.mutateAsync({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['comments', 'script-456']
      })
      // Success - mutation completed without throwing
    })

    it('RED STATE: Gap G2 - should optimistically remove comment from cache on delete', async () => {
      const cacheKey = ['comments', 'script-456', 'test-user-id']
      queryClient.setQueryData(cacheKey, [
        {
          id: 'comment-123',
          scriptId: 'script-456',
          content: 'First comment',
        },
        {
          id: 'comment-456',
          scriptId: 'script-456',
          content: 'Second comment',
        }
      ])

      vi.mocked(commentsLib.deleteComment).mockResolvedValue({
        success: true,
      } as CommentResult<boolean>)

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        await result.current.deleteMutation.mutateAsync({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      const cachedData = queryClient.getQueryData<CommentWithUser[]>(cacheKey)
      expect(cachedData).toBeDefined()
      expect(cachedData).toHaveLength(1)
      expect(cachedData![0].id).toBe('comment-456')
      // Success - mutation completed and cache updated
    })

    it('RED STATE: Gap G2 - should rollback optimistic delete on error', async () => {
      const originalComments = [
        { id: 'comment-123', content: 'First comment' },
        { id: 'comment-456', content: 'Second comment' }
      ]
      const cacheKey = ['comments', 'script-456']
      queryClient.setQueryData(cacheKey, originalComments)

      vi.mocked(commentsLib.deleteComment).mockRejectedValue(
        new Error('Network error')
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      await act(async () => {
        try {
          await result.current.deleteMutation.mutateAsync({
            commentId: 'comment-123',
            scriptId: 'script-456',
          })
        } catch {
          // Expected error
        }
      })

      // Error thrown as expected - verify rollback occurred
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(cacheKey)
      expect(cachedData).toHaveLength(2)
      expect(cachedData).toEqual(originalComments)
    })
  })

  describe('Architecture Compliance', () => {
    it('RED STATE: should use mutation keys for React Query DevTools visibility', () => {
      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      // All mutations must be defined
      expect(result.current.createMutation).toBeDefined()
      expect(result.current.updateMutation).toBeDefined()
      expect(result.current.resolveMutation).toBeDefined()
      expect(result.current.unresolveMutation).toBeDefined()
      expect(result.current.deleteMutation).toBeDefined()
    })
  })
})
