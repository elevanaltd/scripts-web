/**
 * ScriptLockContext - Integration Tests
 *
 * **Test Strategy:** Real Supabase integration (same as useScriptLock tests)
 * - CI: Uses Supabase preview branch (isolated per PR)
 * - Local: Uses local Supabase (supabase start on port 54321)
 *
 * **Coverage:**
 * 1. Provider requirement enforcement (throws without provider)
 * 2. Context state sharing (provider wraps useScriptLock)
 * 3. Multiple consumer safety (no concurrent lock acquisitions)
 *
 * **TMG Architectural Fix:**
 * These tests validate the resolution of the concurrent lock bug:
 * - Multiple components can consume same lock state safely
 * - Only one useScriptLock invocation per script ID
 * - No lock stealing when mounting additional UI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ScriptLockProvider, useScriptLockContext } from './ScriptLockContext'
import { testSupabase, signInAsTestUser, cleanupTestData } from '../test/supabase-test-client'

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

describe.sequential('ScriptLockContext (integration)', () => {
  // Test script ID - uses existing script from seed.sql
  const TEST_SCRIPT_ID = '00000000-0000-0000-0000-000000000101'

  beforeEach(async () => {
    // Clean up any existing locks
    await cleanupTestData(testSupabase)

    // Sign in as admin for test setup
    await signInAsTestUser(testSupabase, 'admin')
  })

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData(testSupabase)
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
      render(
        <ScriptLockProvider scriptId={TEST_SCRIPT_ID} client={testSupabase}>
          <TestConsumer />
        </ScriptLockProvider>
      )

      // Initially checking
      expect(screen.getByTestId('lock-status')).toHaveTextContent('checking')

      // Wait for lock acquisition
      await waitFor(
        () => {
          expect(screen.getByTestId('lock-status')).toHaveTextContent('acquired')
        },
        { timeout: 10000 }
      )

      // Verify lock holder info is displayed
      const lockedBy = screen.getByTestId('locked-by')
      expect(lockedBy).not.toHaveTextContent('none')
      expect(lockedBy.textContent).toBeTruthy()
    }, 15000)
  })

  describe('ScriptLockProvider - Concurrent Consumer Protection', () => {
    it('should allow multiple consumers without lock conflicts', async () => {
      render(
        <ScriptLockProvider scriptId={TEST_SCRIPT_ID} client={testSupabase}>
          <TestConsumer />
          <TestConsumer />
        </ScriptLockProvider>
      )

      // Wait for lock acquisition
      await waitFor(
        () => {
          const statusElements = screen.getAllByTestId('lock-status')
          expect(statusElements[0]).toHaveTextContent('acquired')
          expect(statusElements[1]).toHaveTextContent('acquired')
        },
        { timeout: 10000 }
      )

      // Verify both consumers see the same state
      const statusElements = screen.getAllByTestId('lock-status')
      const lockedByElements = screen.getAllByTestId('locked-by')

      expect(statusElements[0]).toHaveTextContent('acquired')
      expect(statusElements[1]).toHaveTextContent('acquired')
      expect(lockedByElements[0].textContent).toBe(lockedByElements[1].textContent)

      // Verify only ONE lock exists in database (not two competing locks)
      const { data: locks } = await testSupabase.from('script_locks').select('*').eq('script_id', TEST_SCRIPT_ID)

      expect(locks).toBeTruthy()
      expect(locks?.length).toBe(1) // Critical: Only one lock despite two consumers
    }, 15000)
  })
})
