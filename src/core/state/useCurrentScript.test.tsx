import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCurrentScript } from './useCurrentScript'
import { NavigationProvider } from '../../contexts/NavigationContext'
import { AuthProvider } from '../../contexts/AuthContext'
import { useScriptStore } from '../stores/scriptStore'
import type { ReactNode } from 'react'

// Mock service modules
vi.mock('../../services/scriptService', () => ({
  loadScriptForVideo: vi.fn(),
  saveScript: vi.fn(),
  updateScriptStatus: vi.fn(),
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
  },
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

describe('useCurrentScript', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset Zustand store
    useScriptStore.setState({
      saveStatus: 'saved',
      lastSaved: null,
      error: null,
      componentCount: 0,
      workflowStatus: null,
      workflowStatusRollback: null,
    })
  })

  describe('Data Fetching', () => {
    it('returns null script when no video selected', () => {
      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      expect(result.current.currentScript).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('exposes loading state from useCurrentScriptData', () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useCurrentScript(), { wrapper })

      // Without selected video, loading is false (query disabled)
      expect(result.current.isLoading).toBe(false)
    })

    // INTEGRATION TEST - Deferred to component-level testing
    // Requires: NavigationProvider with programmatic selectedVideo control
    // Test Coverage: Will be validated in TipTapEditor integration tests
    it.skip('returns script data when video is selected and data loads', async () => {
      // Component integration test will verify: selectedVideo → triggers query → returns script data
      // This hook is a facade over useCurrentScriptData which IS unit tested
    })
  })

  describe('Save Status Coordination', () => {
    it('exposes saveStatus from Zustand store', () => {
      useScriptStore.setState({ saveStatus: 'saving' })

      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      expect(result.current.saveStatus).toBe('saving')
    })

    it('exposes setSaveStatus from store', () => {
      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      expect(typeof result.current.setSaveStatus).toBe('function')
    })

    it('exposes lastSaved from Zustand store', () => {
      const now = new Date()
      useScriptStore.setState({ lastSaved: now })

      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      expect(result.current.lastSaved).toBe(now)
    })

    it('exposes componentCount from Zustand store', () => {
      useScriptStore.setState({ componentCount: 5 })

      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      expect(result.current.componentCount).toBe(5)
    })
  })

  describe('Save Mutation', () => {
    it('throws error when no script loaded', async () => {
      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      const yjsState = new Uint8Array([1, 2, 3])
      const components = [
        { number: 1, content: 'Component 1', wordCount: 2, hash: 'abc123' },
        { number: 2, content: 'Component 2', wordCount: 2, hash: 'def456' },
      ]

      // GAP-002: save() now accepts ComponentData[] instead of count
      await expect(
        result.current.save(yjsState, 'test content', components)
      ).rejects.toThrow('No script loaded')
    })

    // Deferred: Integration test requiring NavigationProvider test utilities
    it.skip('calls saveMutation with correct parameters when script is loaded', async () => {
      // TODO: Implement once NavigationProvider test utilities exist
      // Should verify: save() → calls saveMutation → correct parameters
    })

    it('exposes isSaving state', () => {
      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isSaving).toBe(false)
    })
  })

  describe('Update Status Mutation', () => {
    it('throws error when no script or video selected', async () => {
      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      await expect(result.current.updateStatus('in_review')).rejects.toThrow(
        'No script or video selected'
      )
    })

    it('exposes isUpdatingStatus state', () => {
      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isUpdatingStatus).toBe(false)
    })
  })

  describe('Error Handling', () => {
    // Deferred: Integration test requiring NavigationProvider test utilities
    it.skip('prioritizes query error over store error when query fails', async () => {
      // TODO: Implement once NavigationProvider test utilities exist
      // Should verify: query error takes precedence
    })

    it('uses store error when no query error', () => {
      useScriptStore.setState({ error: 'Store error' })

      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      expect(result.current.error).toBe('Store error')
    })
  })

  describe('Context Exposure', () => {
    it('exposes selectedVideo from navigation', () => {
      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      // No video selected initially
      expect(result.current.selectedVideo).toBeNull()
    })

    it('exposes userRole from auth context', async () => {
      const { result } = renderHook(() => useCurrentScript(), {
        wrapper: createWrapper(),
      })

      // Auth loads asynchronously
      await waitFor(() => {
        expect(result.current.userRole).toBe('admin')
      }, { timeout: 3000 })
    })
  })

  describe('Integration: Behavior Parity with Low-Level Hooks', () => {
    // Deferred: Full integration test requiring NavigationProvider test utilities
    it.skip('maintains Amendment #1 state coordination pattern during save', async () => {
      // TODO: Implement once NavigationProvider test utilities exist
      // Should verify:
      // 1. Initial state: saveStatus = 'saved'
      // 2. On save: saveStatus = 'saving'
      // 3. On success: saveStatus = 'saved', lastSaved updated
      // 4. State coordination between React Query and Zustand maintained
    })
  })
})
