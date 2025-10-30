import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ScriptLockProvider, useScriptLockContext } from './ScriptLockContext'
import { supabase } from '../lib/supabase'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn()
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        on: vi.fn(() => ({
          subscribe: vi.fn()
        }))
      })),
      unsubscribe: vi.fn()
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
        error: null
      }))
    }
  }
}))

// Test component that uses the context
function TestConsumer() {
  const { lockStatus, lockedBy, releaseLock } = useScriptLockContext()

  return (
    <div>
      <div data-testid="lock-status">{lockStatus}</div>
      <div data-testid="locked-by">{lockedBy?.name || 'none'}</div>
      <button onClick={releaseLock}>Release</button>
    </div>
  )
}

describe('ScriptLockContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useScriptLockContext', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<TestConsumer />)
      }).toThrow('useScriptLockContext must be used within ScriptLockProvider')

      consoleSpy.mockRestore()
    })

    it('should provide lock state from provider', async () => {
      // Mock successful lock acquisition
      const mockLock = {
        id: 'lock-123',
        script_id: 'script-123',
        user_id: 'test-user-id',
        locked_at: new Date().toISOString(),
        user_profiles: {
          display_name: 'Test User'
        }
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockLock, error: null }))
          }))
        })),
        update: vi.fn(),
        delete: vi.fn()
      } as any)

      render(
        <ScriptLockProvider scriptId="script-123">
          <TestConsumer />
        </ScriptLockProvider>
      )

      // Initially checking
      expect(screen.getByTestId('lock-status')).toHaveTextContent('checking')

      // Wait for lock acquisition
      await waitFor(() => {
        expect(screen.getByTestId('lock-status')).toHaveTextContent('acquired')
      })

      expect(screen.getByTestId('locked-by')).toHaveTextContent('Test User')
    })
  })

  describe('ScriptLockProvider', () => {
    it('should provide shared lock state to multiple consumers', async () => {
      // Mock successful lock acquisition
      const mockLock = {
        id: 'lock-123',
        script_id: 'script-123',
        user_id: 'test-user-id',
        locked_at: new Date().toISOString(),
        user_profiles: {
          display_name: 'Test User'
        }
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockLock, error: null }))
          }))
        })),
        update: vi.fn(),
        delete: vi.fn()
      } as any)

      render(
        <ScriptLockProvider scriptId="script-123">
          <TestConsumer />
          <TestConsumer />
        </ScriptLockProvider>
      )

      // Wait for lock acquisition
      await waitFor(() => {
        const statusElements = screen.getAllByTestId('lock-status')
        expect(statusElements[0]).toHaveTextContent('acquired')
        expect(statusElements[1]).toHaveTextContent('acquired')
      })

      // Verify both consumers see the same state
      const statusElements = screen.getAllByTestId('lock-status')
      const lockedByElements = screen.getAllByTestId('locked-by')

      expect(statusElements[0]).toHaveTextContent('acquired')
      expect(statusElements[1]).toHaveTextContent('acquired')
      expect(lockedByElements[0]).toHaveTextContent('Test User')
      expect(lockedByElements[1]).toHaveTextContent('Test User')
    })
  })
})
