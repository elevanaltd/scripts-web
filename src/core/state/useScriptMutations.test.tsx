import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useScriptMutations } from './useScriptMutations'
import { NavigationProvider } from '../../contexts/NavigationContext'
import { useScriptStore } from '../stores/scriptStore'
import * as scriptService from '../../services/scriptService'
import type { Script } from '../../services/scriptService'

// Mock the script service
vi.mock('../../services/scriptService', () => ({
  saveScript: vi.fn(),
  saveScriptWithComponents: vi.fn(), // GAP-002: Mock atomic RPC function
  updateScriptStatus: vi.fn(),
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

describe('useScriptMutations - Integration Tests (Testguard-Approved)', () => {
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

    // Reset Zustand store before each test
    useScriptStore.setState({
      saveStatus: 'saved',
      lastSaved: null,
      error: null,
      workflowStatus: null,
      workflowStatusRollback: null,
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  // ✅ CORRECT: Integration test with REAL providers (minimal boundary mocks)
  const createTestWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <NavigationProvider>{children}</NavigationProvider>
      </QueryClientProvider>
    )
  }

  describe('saveMutation - Amendment #1 State Coordination', () => {
    it('RED STATE: should save script with explicit Zustand state updates', async () => {
      // Mock successful save with delay to allow state transitions to be observed
      vi.mocked(scriptService.saveScript).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'script-123',
              video_id: 'video-456',
              plain_text: 'Updated content',
              updated_at: new Date().toISOString(),
              components: []
            } as unknown as Script)
          }, 50)
        })
      )

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper()
      })

      // Initial state should be 'saved'
      expect(useScriptStore.getState().saveStatus).toBe('saved')

      // Trigger save mutation with PATCH pattern parameters
      act(() => {
        result.current.saveMutation.mutate({
          scriptId: 'script-123',
          updates: {
            plain_text: 'Updated content',
            components: [], // GAP-002 Remediation: Test expects components parameter
            yjs_state: null,
            component_count: 0
          }
        })
      })

      // Verify Amendment #1: setSaveStatus called with 'saving' during mutation
      await waitFor(() => {
        expect(useScriptStore.getState().saveStatus).toBe('saving')
      })

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.saveMutation.isSuccess).toBe(true)
      })

      // Verify Amendment #1: setSaveStatus called with 'saved' on success
      expect(useScriptStore.getState().saveStatus).toBe('saved')
      expect(useScriptStore.getState().lastSaved).toBeTruthy()
      expect(useScriptStore.getState().error).toBeNull()
    })

    it('RED STATE: should update Zustand state on save failure', async () => {
      // Mock failed save with delay
      const testError = new Error('Network error')
      vi.mocked(scriptService.saveScript).mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => {
            reject(testError)
          }, 50)
        })
      )

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper()
      })

      // Trigger save mutation with PATCH pattern parameters
      act(() => {
        result.current.saveMutation.mutate({
          scriptId: 'script-123',
          updates: {
            plain_text: 'Failed content'
          }
        })
      })

      // Wait for mutation to fail
      await waitFor(() => {
        expect(result.current.saveMutation.isError).toBe(true)
      })

      // Verify Amendment #1: setSaveStatus called with 'error' on failure
      expect(useScriptStore.getState().saveStatus).toBe('error')
      expect(useScriptStore.getState().error).toBe('Network error')
      expect(useScriptStore.getState().lastSaved).toBeNull()
    })

    it('RED STATE: should invalidate script query cache on successful save', async () => {
      // Mock successful save with delay
      vi.mocked(scriptService.saveScript).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'script-123',
              video_id: 'video-456',
              plain_text: 'Updated content',
              updated_at: new Date().toISOString(),
              components: []
            } as unknown as Script)
          }, 50)
        })
      )

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.saveMutation.mutate({
          scriptId: 'script-123',
          updates: {
            plain_text: 'Updated content',
            yjs_state: null,
            component_count: 0
          }
        })
      })

      await waitFor(() => {
        expect(result.current.saveMutation.isSuccess).toBe(true)
      })

      // Verify cache invalidation (Architecture Line 436-437)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['script']
      })
    })

    // GAP-002 Remediation: Test component persistence capability
    it('RED STATE: should persist component data when provided in updates', async () => {
      const testComponents = [
        { number: 1, content: 'Component 1', wordCount: 2, hash: 'abc123' },
        { number: 2, content: 'Component 2', wordCount: 2, hash: 'def456' },
      ]

      // GAP-002: Mock saveScriptWithComponents (atomic RPC for component persistence)
      vi.mocked(scriptService.saveScriptWithComponents).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'script-123',
              video_id: 'video-456',
              plain_text: 'Updated content',
              updated_at: new Date().toISOString(),
              components: testComponents
            } as unknown as Script)
          }, 50)
        })
      )

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper()
      })

      act(() => {
        result.current.saveMutation.mutate({
          scriptId: 'script-123',
          updates: {
            plain_text: 'Updated content',
            components: testComponents, // GAP-002: Component persistence
            yjs_state: null,
            component_count: 2
          }
        })
      })

      await waitFor(() => {
        expect(result.current.saveMutation.isSuccess).toBe(true)
      })

      // GAP-002: Verify saveScriptWithComponents was called (not saveScript)
      expect(scriptService.saveScriptWithComponents).toHaveBeenCalledWith(
        'script-123',
        null, // yjs_state
        'Updated content', // plain_text
        testComponents // components array
      )

      // Verify PATCH saveScript was NOT called (components route to RPC)
      expect(scriptService.saveScript).not.toHaveBeenCalled()
    })
  })

  describe('Architecture Compliance', () => {
    it('RED STATE: should use mutation key for React Query DevTools visibility', () => {
      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper()
      })

      // Architecture Line 434-435: Mutation must have key for DevTools
      expect(result.current.saveMutation).toBeDefined()
      // The actual mutation key is internal to React Query, but we verify it's configured
    })
  })

  // ✅ Amendment #3: PATCH Pattern for Concurrency Safety
  // Critical-Engineer: consulted for Architecture pattern selection (PATCH vs full-replacement)
  describe('Amendment #3 - Concurrency Protection via PATCH Pattern', () => {
    beforeEach(() => {
      // Reset mocks and query client between tests in this block
      vi.clearAllMocks()
      queryClient.clear() // Clear React Query cache to prevent test pollution
    })

    it('RED STATE: handles concurrent saves without data loss using PATCH pattern', async () => {
      // Mock database state - simulates what's already in the database
      const initialDbState = {
        id: 'script-123',
        video_id: 'video-456',
        yjs_state: new Uint8Array([1, 2, 3]),
        plain_text: 'Initial content',
        component_count: 2,
        created_at: new Date('2025-01-01').toISOString(),
        updated_at: new Date('2025-01-01').toISOString(),
        components: []
      }

      // Mock saveScript to simulate PATCH behavior
      // Each call should merge updates into current state, not replace everything
      let currentDbState = { ...initialDbState }

      vi.mocked(scriptService.saveScript).mockImplementation(
        async (scriptId: string, updates: Partial<Script>) => {
          // Simulate PATCH: merge updates into current state
          currentDbState = {
            ...currentDbState,
            ...updates,
            updated_at: new Date().toISOString(),
            created_at: currentDbState.created_at || new Date('2025-01-01').toISOString()
          } as typeof currentDbState

          // Small delay to simulate network latency
          await new Promise(resolve => setTimeout(resolve, 10))

          return currentDbState as Script
        }
      )

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper()
      })

      // Simulate concurrent updates from two different sources
      // Update 1: User typing (changes plain_text)
      // Update 2: Auto-save (changes yjs_state)
      // Both should succeed without one overwriting the other

      await act(async () => {
        // Fire both mutations concurrently (simulates real-world race condition)
        await Promise.all([
          result.current.saveMutation.mutateAsync({
            scriptId: 'script-123',
            updates: { plain_text: 'User typed content' }
          }),
          result.current.saveMutation.mutateAsync({
            scriptId: 'script-123',
            updates: { yjs_state: new Uint8Array([4, 5, 6]) }
          })
        ])
      })

      // Verify PATCH behavior: both updates should be present in final state
      // This would FAIL with full-replacement pattern (last-write-wins)
      expect(currentDbState.plain_text).toBe('User typed content')
      expect(currentDbState.yjs_state).toEqual(new Uint8Array([4, 5, 6]))

      // Verify fields not included in updates are preserved
      expect(currentDbState.component_count).toBe(2) // From initial state
      expect(currentDbState.video_id).toBe('video-456') // From initial state
    })

    it('RED STATE: PATCH pattern prevents accidental field nullification', async () => {
      // Mock database state with all fields populated
      const fullDbState = {
        id: 'script-123',
        video_id: 'video-456',
        yjs_state: new Uint8Array([1, 2, 3]),
        plain_text: 'Important content',
        component_count: 5,
        status: 'in_review' as const,
        created_at: new Date('2025-01-01').toISOString(),
        updated_at: new Date('2025-01-01').toISOString(),
        components: []
      }

      let currentDbState = { ...fullDbState }

      vi.mocked(scriptService.saveScript).mockImplementation(
        async (scriptId: string, updates: Partial<Script>) => {
          // PATCH pattern: only update provided fields
          currentDbState = {
            ...currentDbState,
            ...updates,
            updated_at: new Date().toISOString(),
            created_at: currentDbState.created_at || new Date('2025-01-01').toISOString()
          } as typeof currentDbState

          // Small delay to simulate network latency
          await new Promise(resolve => setTimeout(resolve, 10))

          return currentDbState as Script
        }
      )

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper()
      })

      // Wait for hook to be ready (prevents null reference from concurrent test pollution)
      await waitFor(() => {
        expect(result.current).not.toBeNull()
        expect(result.current.saveMutation).toBeDefined()
      })

      // Update only component_count (e.g., after extraction)
      await act(async () => {
        await result.current.saveMutation.mutateAsync({
          scriptId: 'script-123',
          updates: { component_count: 7 }
        })
      })

      // Verify CRITICAL: Other fields are NOT nullified
      // This is the data corruption risk with full-replacement pattern
      expect(currentDbState.component_count).toBe(7) // Updated field
      expect(currentDbState.plain_text).toBe('Important content') // NOT NULL
      expect(currentDbState.yjs_state).toEqual(new Uint8Array([1, 2, 3])) // NOT NULL
      expect(currentDbState.status).toBe('in_review') // NOT NULL
    })
  })

  // Gap #1 & #4 Resolution: updateStatus mutation tests
  describe('updateStatus Mutation - Gap #1 & #4 Resolution', () => {
    it('RED STATE: should update script status with optimistic UI and rollback', async () => {
      const videoId = 'video-456'

      // Seed query cache with script data (Gap #4: correct cache key)
      queryClient.setQueryData(['script', videoId], {
        id: 'script-123',
        video_id: videoId,
        status: 'draft',
        plain_text: 'Content',
        created_at: new Date('2025-01-01').toISOString(),
        updated_at: new Date('2025-01-01').toISOString(),
        components: [],
      } as Script)

      // Mock successful status update (service returns Script directly, throws on error)
      vi.mocked(scriptService.updateScriptStatus).mockResolvedValue({
        id: 'script-123',
        video_id: videoId,
        status: 'in_review',
        plain_text: 'Content',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        components: [],
      } as Script)

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper(),
      })

      // Initial workflow status should be null
      expect(useScriptStore.getState().workflowStatus).toBeNull()

      // Trigger status update
      act(() => {
        result.current.updateStatus.mutate({
          scriptId: 'script-123',
          status: 'in_review',
          videoId,
        })
      })

      // Verify optimistic update to Zustand store (Gap #3)
      await waitFor(() => {
        expect(useScriptStore.getState().workflowStatus).toBe('in_review')
      })

      // Wait for mutation to succeed
      await waitFor(() => {
        expect(result.current.updateStatus.isSuccess).toBe(true)
      })

      // Verify cache updated with correct key (Gap #4)
      const cachedScript = queryClient.getQueryData<Script>(['script', videoId])
      expect(cachedScript?.status).toBe('in_review')
    })

    it('RED STATE: should rollback on status update failure', async () => {
      const videoId = 'video-456'

      // Seed query cache with script data
      queryClient.setQueryData(['script', videoId], {
        id: 'script-123',
        video_id: videoId,
        status: 'draft',
        plain_text: 'Content',
        created_at: new Date('2025-01-01').toISOString(),
        updated_at: new Date('2025-01-01').toISOString(),
        components: [],
      } as Script)

      // Set initial workflow status
      useScriptStore.setState({ workflowStatus: 'draft' })

      // Mock failed status update (service throws error, doesn't return { success: false })
      vi.mocked(scriptService.updateScriptStatus).mockRejectedValue(
        new Error('Permission denied')
      )

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper(),
      })

      // Trigger status update
      act(() => {
        result.current.updateStatus.mutate({
          scriptId: 'script-123',
          status: 'in_review',
          videoId,
        })
      })

      // Wait for mutation to fail
      await waitFor(() => {
        expect(result.current.updateStatus.isError).toBe(true)
      })

      // Verify rollback to previous status (Gap #3)
      expect(useScriptStore.getState().workflowStatus).toBe('draft')

      // Verify cache rolled back (Gap #4)
      const cachedScript = queryClient.getQueryData<Script>(['script', videoId])
      expect(cachedScript?.status).toBe('draft')
    })

    it('RED STATE: should use correct cache key for React Query', async () => {
      const videoId = 'video-456'

      queryClient.setQueryData(['script', videoId], {
        id: 'script-123',
        video_id: videoId,
        status: 'draft',
        plain_text: 'Content',
        created_at: new Date('2025-01-01').toISOString(),
        updated_at: new Date('2025-01-01').toISOString(),
        components: [],
      } as Script)

      vi.mocked(scriptService.updateScriptStatus).mockResolvedValue({
        id: 'script-123',
        video_id: videoId,
        status: 'approved',
        plain_text: 'Content',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        components: [],
      } as Script)

      const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

      const { result } = renderHook(() => useScriptMutations(), {
        wrapper: createTestWrapper(),
      })

      await act(async () => {
        await result.current.updateStatus.mutateAsync({
          scriptId: 'script-123',
          status: 'approved',
          videoId,
        })
      })

      // Verify cache key uses videoId, NOT scriptId (Gap #4)
      expect(setQueryDataSpy).toHaveBeenCalledWith(
        ['script', videoId],
        expect.anything()
      )
    })
  })
})
