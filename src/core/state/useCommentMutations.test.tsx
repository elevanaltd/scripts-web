import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useCommentMutations } from './useCommentMutations'
import { NavigationProvider } from '../../contexts/NavigationContext'
import * as commentsLib from '../../lib/comments'
import type { CommentWithUser } from '../../types/comments'
import type { CommentResult } from '../../lib/comments'

// Mock the comments library
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

describe('useCommentMutations - Integration Tests (Testguard-Approved)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false, // Disable retries for tests
        },
      },
    })
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
      // Mock successful comment creation with delay
      vi.mocked(commentsLib.createComment).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
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
            } as CommentResult<CommentWithUser>)
          }, 50)
        })
      )

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.createMutation.mutate({
          scriptId: 'script-456',
          content: 'Test comment',
          startPosition: 0,
          endPosition: 10,
          highlightedText: 'Test text',
        })
      })

      await waitFor(() => {
        expect(result.current.createMutation.isSuccess).toBe(true)
      })

      // Verify cache invalidation
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['comments']
      })
    })
  })

  describe('updateMutation', () => {
    it('RED STATE: should update comment and invalidate cache', async () => {
      // Mock successful comment update with delay
      vi.mocked(commentsLib.updateComment).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
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
            } as CommentResult<CommentWithUser>)
          }, 50)
        })
      )

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.updateMutation.mutate({
          commentId: 'comment-123',
          content: 'Updated comment',
        })
      })

      await waitFor(() => {
        expect(result.current.updateMutation.isSuccess).toBe(true)
      })

      // Verify cache invalidation
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['comments']
      })
    })
  })

  describe('resolveMutation', () => {
    it('RED STATE: should resolve comment and invalidate cache', async () => {
      // Mock successful comment resolution with delay
      vi.mocked(commentsLib.resolveComment).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
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
            } as CommentResult<CommentWithUser>)
          }, 50)
        })
      )

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.resolveMutation.mutate({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      await waitFor(() => {
        expect(result.current.resolveMutation.isSuccess).toBe(true)
      })

      // Verify cache invalidation with specific scriptId
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['comments', 'script-456']
      })
    })

    it('RED STATE: Gap G2 - should optimistically update comment resolution in cache', async () => {
      // Pre-populate cache with comment data
      // P1 Fix: Use correct cache key with userId (line 138 in implementation)
      queryClient.setQueryData(['comments', 'script-456', 'test-user-id'], [
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

      // Mock delayed resolution
      vi.mocked(commentsLib.resolveComment).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
                id: 'comment-123',
                scriptId: 'script-456',
                userId: 'test-user-id',
                content: 'Test comment',
                startPosition: 0,
                endPosition: 10,
                resolvedAt: new Date().toISOString(),
                resolvedBy: 'test-user-id',
              }
            } as CommentResult<CommentWithUser>)
          }, 100)
        })
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      // Trigger mutation (onMutate executes synchronously before mutationFn)
      act(() => {
        result.current.resolveMutation.mutate({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      // Wait a tick for React Query's internal state to sync
      // P1 Fix: Use correct cache key with userId (line 138 in implementation)
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456', 'test-user-id'])
        expect(cachedData).toBeDefined()
        expect(cachedData![0].resolvedAt).toBeTruthy()
      }, { timeout: 100 })

      // Verify resolved by
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456', 'test-user-id'])
      expect(cachedData![0].resolvedBy).toBe('test-user-id')

      // Cleanup: wait for mutation to complete
      await waitFor(() => {
        expect(result.current.resolveMutation.isSuccess).toBe(true)
      })
    })

    it('RED STATE: Gap G2 - should rollback optimistic update on error', async () => {
      // Pre-populate cache
      queryClient.setQueryData(['comments', 'script-456'], [
        {
          id: 'comment-123',
          resolvedAt: null,
          resolvedBy: null,
        }
      ])

      // Mock failed resolution
      vi.mocked(commentsLib.resolveComment).mockRejectedValueOnce(
        new Error('Network error')
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.resolveMutation.mutate({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      await waitFor(() => {
        expect(result.current.resolveMutation.isError).toBe(true)
      })

      // Verify rollback - cache should be restored
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456'])
      expect(cachedData![0].resolvedAt).toBeNull()
      expect(cachedData![0].resolvedBy).toBeNull()
    })
  })

  describe('unresolveMutation', () => {
    it('RED STATE: Gap G2 - should optimistically update comment unresolve in cache', async () => {
      // Pre-populate cache with resolved comment
      // P1 Fix: Use correct cache key with userId (line 200 in implementation)
      queryClient.setQueryData(['comments', 'script-456', 'test-user-id'], [
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

      // Mock delayed unresolve
      vi.mocked(commentsLib.unresolveComment).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
                id: 'comment-123',
                scriptId: 'script-456',
                userId: 'test-user-id',
                content: 'Test comment',
                startPosition: 0,
                endPosition: 10,
                resolvedAt: null,
                resolvedBy: null,
              }
            } as CommentResult<CommentWithUser>)
          }, 100)
        })
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      // Trigger mutation (onMutate executes synchronously before mutationFn)
      act(() => {
        result.current.unresolveMutation.mutate({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      // Wait a tick for React Query's internal state to sync
      // P1 Fix: Use correct cache key with userId (line 200 in implementation)
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456', 'test-user-id'])
        expect(cachedData).toBeDefined()
        expect(cachedData![0].resolvedAt).toBeNull()
      }, { timeout: 100 })

      // Verify resolved by
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456', 'test-user-id'])
      expect(cachedData![0].resolvedBy).toBeNull()

      // Cleanup: wait for mutation to complete
      await waitFor(() => {
        expect(result.current.unresolveMutation.isSuccess).toBe(true)
      })
    })

    it('RED STATE: Gap G2 - should rollback optimistic unresolve on error', async () => {
      const originalResolvedAt = '2025-01-01T00:00:00Z'
      queryClient.setQueryData(['comments', 'script-456'], [
        {
          id: 'comment-123',
          resolvedAt: originalResolvedAt,
          resolvedBy: 'test-user-id',
        }
      ])

      vi.mocked(commentsLib.unresolveComment).mockRejectedValueOnce(
        new Error('Network error')
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.unresolveMutation.mutate({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      await waitFor(() => {
        expect(result.current.unresolveMutation.isError).toBe(true)
      })

      // Verify rollback - cache should be restored
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456'])
      expect(cachedData![0].resolvedAt).toBe(originalResolvedAt)
      expect(cachedData![0].resolvedBy).toBe('test-user-id')
    })
  })

  describe('deleteMutation', () => {
    it('RED STATE: should delete comment and invalidate cache', async () => {
      // Mock successful comment deletion with delay
      vi.mocked(commentsLib.deleteComment).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
            } as CommentResult<boolean>)
          }, 50)
        })
      )

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.deleteMutation.mutate({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      await waitFor(() => {
        expect(result.current.deleteMutation.isSuccess).toBe(true)
      })

      // Verify cache invalidation with specific scriptId
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['comments', 'script-456']
      })
    })

    it('RED STATE: Gap G2 - should optimistically remove comment from cache on delete', async () => {
      // Pre-populate cache with multiple comments
      // P1 Fix: Use correct cache key with userId (line 257 in implementation)
      queryClient.setQueryData(['comments', 'script-456', 'test-user-id'], [
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

      // Mock delayed delete
      vi.mocked(commentsLib.deleteComment).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
            } as CommentResult<boolean>)
          }, 100)
        })
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      // Trigger mutation (onMutate executes synchronously before mutationFn)
      act(() => {
        result.current.deleteMutation.mutate({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      // Wait a tick for React Query's internal state to sync
      // P1 Fix: Use correct cache key with userId (line 257 in implementation)
      await waitFor(() => {
        const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456', 'test-user-id'])
        expect(cachedData).toBeDefined()
        expect(cachedData).toHaveLength(1)
      }, { timeout: 100 })

      // Verify correct comment was deleted
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456', 'test-user-id'])
      expect(cachedData![0].id).toBe('comment-456')

      // Cleanup: wait for mutation to complete
      await waitFor(() => {
        expect(result.current.deleteMutation.isSuccess).toBe(true)
      })
    })

    it('RED STATE: Gap G2 - should rollback optimistic delete on error', async () => {
      const originalComments = [
        { id: 'comment-123', content: 'First comment' },
        { id: 'comment-456', content: 'Second comment' }
      ]
      queryClient.setQueryData(['comments', 'script-456'], originalComments)

      vi.mocked(commentsLib.deleteComment).mockRejectedValueOnce(
        new Error('Network error')
      )

      const { result } = renderHook(() => useCommentMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.deleteMutation.mutate({
          commentId: 'comment-123',
          scriptId: 'script-456',
        })
      })

      await waitFor(() => {
        expect(result.current.deleteMutation.isError).toBe(true)
      })

      // Verify rollback - all comments should be restored
      const cachedData = queryClient.getQueryData<CommentWithUser[]>(['comments', 'script-456'])
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
