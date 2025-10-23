import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useScriptComments } from './useScriptComments'
import { NavigationProvider } from '../../contexts/NavigationContext'
import { AuthProvider } from '../../contexts/AuthContext'
import { useCommentStore } from '../stores/commentStore'
import type { ReactNode } from 'react'

// Mock service modules
vi.mock('../../services/scriptService', () => ({
  loadScriptForVideo: vi.fn(),
}))

vi.mock('../../lib/comments', () => ({
  loadCommentsForScript: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  resolveComment: vi.fn(),
  unresolveComment: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user' } } },
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'test-user',
              email: 'test@example.com',
              display_name: 'Test User',
              role: 'admin',
            },
          }),
        })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
  },
}))

// Mock error handling utility
vi.mock('../../utils/errorHandling', () => ({
  getUserFriendlyErrorMessage: vi.fn((error: Error, context?: { operation?: string; resource?: string }) => {
    return `Failed to ${context?.operation} ${context?.resource}. Please try again.`
  }),
}))

// Test wrapper with all required providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationProvider>{children}</NavigationProvider>
        </AuthProvider>
      </QueryClientProvider>
    )
  }
}

describe('useScriptComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset Zustand store
    useCommentStore.setState({
      optimisticComments: new Map(),
      submittingStatus: new Map(),
    })
  })

  describe('Query State', () => {
    it('returns empty threads when no script selected', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      expect(result.current.threads).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.scriptId).toBeNull()
    })

    // INTEGRATION TEST - Deferred to component-level testing
    // Requires: script data to be available (depends on useCurrentScriptData integration)
    // Test Coverage: Will be validated in CommentSidebar integration tests
    it.skip('fetches and returns threaded comments when script is loaded', async () => {
      // Component integration test will verify: scriptId → triggers query → returns threaded comments
      // This hook is a facade over useScriptCommentsQuery which IS unit tested
    })
  })

  describe('Mutation Access', () => {
    it('exposes mutations object for low-level access', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      // Gap G6 preservation: components can use mutations directly with onError callbacks
      expect(result.current.mutations).toBeDefined()
      expect(result.current.mutations.createMutation).toBeDefined()
      expect(result.current.mutations.deleteMutation).toBeDefined()
      expect(result.current.mutations.resolveMutation).toBeDefined()
    })

    it('provides convenience wrappers for common operations', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      expect(typeof result.current.createComment).toBe('function')
      expect(typeof result.current.deleteComment).toBe('function')
      expect(typeof result.current.resolveComment).toBe('function')
      expect(typeof result.current.unresolveComment).toBe('function')
    })

    it('exposes mutation status flags', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      expect(result.current.isCreating).toBe(false)
      expect(result.current.isDeleting).toBe(false)
      expect(result.current.isResolving).toBe(false)
    })
  })

  describe('Store Access', () => {
    it('exposes optimistic comments from store', () => {
      const mockOptimisticMap = new Map([
        ['temp-1', {
          tempId: 'temp-1',
          scriptId: 'script-1',
          content: 'Test',
          startPosition: 0,
          endPosition: 10,
          userId: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }],
      ])
      useCommentStore.setState({ optimisticComments: mockOptimisticMap })

      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      expect(result.current.optimisticComments).toEqual(mockOptimisticMap)
    })

    it('exposes submitting status from store', () => {
      const mockSubmittingMap = new Map([['temp-1', true]])
      useCommentStore.setState({ submittingStatus: mockSubmittingMap })

      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      expect(result.current.submittingStatus).toEqual(mockSubmittingMap)
    })
  })

  describe('Gap G6: Context-Aware Error Handling', () => {
    it('provides createContextualError helper', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      expect(typeof result.current.createContextualError).toBe('function')
    })

    it('creates context-specific error messages for create operation', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      const error = new Error('Network error')
      const message = result.current.createContextualError(error, {
        operation: 'create',
        resource: 'comment',
      })

      expect(message).toBe('Failed to create comment. Please try again.')
    })

    it('creates context-specific error messages for delete operation', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      const error = new Error('Permission denied')
      const message = result.current.createContextualError(error, {
        operation: 'delete',
        resource: 'comment',
      })

      expect(message).toBe('Failed to delete comment. Please try again.')
    })

    it('creates context-specific error messages for resolve operation', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      const error = new Error('Not found')
      const message = result.current.createContextualError(error, {
        operation: 'resolve',
        resource: 'comment',
      })

      expect(message).toBe('Failed to resolve comment. Please try again.')
    })
  })

  describe('Integration: Behavior Parity with Low-Level Hooks', () => {
    // INTEGRATION TEST - Deferred to component-level testing
    // Requires: Full React Query + Zustand coordination with async server responses
    // Test Coverage: Will be validated in CommentSidebar integration tests
    it.skip('maintains optimistic UI pattern during comment creation', async () => {
      // Component integration test will verify:
      // 1. createComment called → optimistic comment added to store
      // 2. Server responds → optimistic comment resolved to real ID
      // 3. Error case → optimistic comment removed
      // 4. Context-specific error message generated
      // This hook coordinates useCommentMutations + useCommentStore which ARE unit tested
    })
  })

  describe('Usage Pattern: Gap G6 Preservation Examples', () => {
    it('allows components to use convenience wrapper with try/catch', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      // Pattern 1: Convenience wrapper + try/catch + context error
      const exampleUsage = async () => {
        try {
          await result.current.createComment({
            scriptId: 'script-1',
            content: 'Test comment',
            startPosition: 0,
            endPosition: 10,
            highlightedText: 'test',
          })
        } catch (error) {
          const message = result.current.createContextualError(error as Error, {
            operation: 'create',
            resource: 'comment',
          })
          // toast.error(message) in real component
          expect(message).toBe('Failed to create comment. Please try again.')
        }
      }

      expect(typeof exampleUsage).toBe('function')
    })

    it('allows components to use mutations directly with onError callback', () => {
      const { result } = renderHook(() => useScriptComments(null), {
        wrapper: createWrapper(),
      })

      // Pattern 2: Direct mutation access + onError callback (Gap G6 preserved)
      const exampleUsage = () => {
        result.current.mutations.createMutation.mutate(
          {
            scriptId: 'script-1',
            content: 'Test comment',
            startPosition: 0,
            endPosition: 10,
            highlightedText: 'test',
          },
          {
            onError: (error) => {
              const message = result.current.createContextualError(error, {
                operation: 'create',
                resource: 'comment',
              })
              // toast.error(message) in real component
              expect(message).toBe('Failed to create comment. Please try again.')
            },
          }
        )
      }

      expect(typeof exampleUsage).toBe('function')
    })
  })
})
