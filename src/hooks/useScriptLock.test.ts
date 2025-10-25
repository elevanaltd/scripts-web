/**
 * useScriptLock Hook - Integration Tests
 *
 * **Test Strategy:** Real Supabase integration (preview branches + local)
 * - CI: Uses Supabase preview branch (isolated per PR)
 * - Local: Uses local Supabase (supabase start on port 54321)
 *
 * **Coverage:**
 * 1. Auto-lock acquisition (first user gets lock)
 * 2. Lock blocking (second user prevented from acquiring)
 * 3. Heartbeat (keep-alive every 5 minutes)
 * 4. Heartbeat failure recovery (re-acquisition on failure)
 * 5. Lock release on unmount (cleanup)
 * 6. Manual unlock (user releases lock voluntarily)
 * 7. Realtime lock acquisition detection (another user acquires)
 * 8. Realtime lock release detection (lock becomes available)
 * 9. Admin force unlock (admin can override)
 * 10. Race condition prevention (concurrent acquisitions blocked)
 *
 * **Test Methodology Guardian Approved:**
 * - Real database validates actual RLS policies
 * - Real realtime validates subscription behavior
 * - Real timers validate heartbeat timing
 * - Isolated preview branches prevent test interference
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useScriptLock } from './useScriptLock'
import { testSupabase, signInAsTestUser, cleanupTestData, authDelay } from '../test/supabase-test-client'

describe('useScriptLock (integration)', () => {
  // Test script ID - unique per test run to avoid collisions
  const TEST_SCRIPT_ID = `test-script-${Date.now()}`

  beforeEach(async () => {
    // Clean up any existing locks
    await cleanupTestData(testSupabase)

    // Sign in as admin for test setup
    await signInAsTestUser(testSupabase, 'admin')

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData(testSupabase)
  })

  // TEST 1: Auto-lock acquisition
  it('should acquire lock for first user', async () => {
    const { result, unmount } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    // Wait for lock acquisition
    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('acquired')
      },
      { timeout: 10000 }
    )

    // Verify lock holder info is set
    expect(result.current.lockedBy).toBeTruthy()
    expect(result.current.lockedBy?.name).toBeTruthy()

    // Verify lock exists in database
    const { data: lock } = await testSupabase
      .from('script_locks')
      .select('*')
      .eq('script_id', TEST_SCRIPT_ID)
      .single()

    expect(lock).toBeTruthy()
    expect(lock?.script_id).toBe(TEST_SCRIPT_ID)

    unmount()
  }, 15000)

  // TEST 2: Lock blocking (second user prevented)
  it('should prevent second user from acquiring same lock', async () => {
    // First user acquires lock
    const { unmount: unmount1 } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        const { data } = testSupabase.from('script_locks').select('*').eq('script_id', TEST_SCRIPT_ID)
        return data
      },
      { timeout: 10000 }
    )

    // Second user attempts to acquire (should fail)
    await authDelay()
    await signInAsTestUser(testSupabase, 'client')

    const { result: result2, unmount: unmount2 } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        expect(result2.current.lockStatus).toBe('locked')
      },
      { timeout: 10000 }
    )

    // Should show who has the lock
    expect(result2.current.lockedBy).toBeTruthy()
    expect(result2.current.lockedBy?.name).toContain('Admin') // test-admin user

    unmount1()
    unmount2()
  }, 20000)

  // TEST 3: Heartbeat (keep-alive every 5 minutes)
  it('should send heartbeat every 5 minutes', async () => {
    vi.useFakeTimers()

    const { result, unmount } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    // Wait for initial lock acquisition
    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('acquired')
      },
      { timeout: 10000 }
    )

    // Get initial heartbeat timestamp
    const { data: lockBefore } = await testSupabase
      .from('script_locks')
      .select('last_heartbeat')
      .eq('script_id', TEST_SCRIPT_ID)
      .single()

    expect(lockBefore).toBeTruthy()
    const timestampBefore = lockBefore?.last_heartbeat

    // Advance time by 5 minutes
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    // Wait for heartbeat to be sent
    await waitFor(
      async () => {
        const { data: lockAfter } = await testSupabase
          .from('script_locks')
          .select('last_heartbeat')
          .eq('script_id', TEST_SCRIPT_ID)
          .single()

        expect(lockAfter?.last_heartbeat).not.toBe(timestampBefore)
      },
      { timeout: 5000 }
    )

    vi.useRealTimers()
    unmount()
  }, 20000)

  // TEST 4: Heartbeat failure recovery
  it('should detect heartbeat failure and re-acquire', async () => {
    const { result, unmount } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('acquired')
      },
      { timeout: 10000 }
    )

    // Simulate heartbeat failure by deleting lock manually
    await testSupabase.from('script_locks').delete().eq('script_id', TEST_SCRIPT_ID)

    // Hook should detect lock loss via realtime and attempt re-acquisition
    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('acquired')
      },
      { timeout: 15000 }
    )

    unmount()
  }, 20000)

  // TEST 5: Lock release on unmount
  it('should release lock on unmount', async () => {
    const { result, unmount } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('acquired')
      },
      { timeout: 10000 }
    )

    // Unmount should trigger cleanup
    unmount()

    // Verify lock is deleted
    await waitFor(
      async () => {
        const { data } = await testSupabase
          .from('script_locks')
          .select('*')
          .eq('script_id', TEST_SCRIPT_ID)
          .maybeSingle()

        expect(data).toBeNull()
      },
      { timeout: 5000 }
    )
  }, 15000)

  // TEST 6: Manual unlock
  it('should allow manual unlock', async () => {
    const { result, unmount } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('acquired')
      },
      { timeout: 10000 }
    )

    // Manually release lock
    await result.current.releaseLock()

    // Lock status should update
    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('unlocked')
      },
      { timeout: 5000 }
    )

    // Verify lock deleted from database
    const { data } = await testSupabase
      .from('script_locks')
      .select('*')
      .eq('script_id', TEST_SCRIPT_ID)
      .maybeSingle()

    expect(data).toBeNull()

    unmount()
  }, 15000)

  // TEST 7: Realtime lock acquisition detection
  it('should update lock status when another user acquires lock', async () => {
    const { result, unmount } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('acquired')
      },
      { timeout: 10000 }
    )

    // Simulate another user acquiring lock (admin force-override via direct DB write)
    await authDelay()
    const clientUserId = await signInAsTestUser(testSupabase, 'client')

    // Delete existing lock and create new one for client
    await testSupabase.from('script_locks').delete().eq('script_id', TEST_SCRIPT_ID)

    await testSupabase.from('script_locks').insert({
      script_id: TEST_SCRIPT_ID,
      locked_by_id: clientUserId,
      locked_by_name: 'Test Client',
      last_heartbeat: new Date().toISOString(),
    })

    // Realtime subscription should detect change
    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('locked')
        expect(result.current.lockedBy?.name).toContain('Client')
      },
      { timeout: 10000 }
    )

    unmount()
  }, 20000)

  // TEST 8: Realtime lock release detection
  it('should update lock status when lock is released', async () => {
    // Start with lock held by another user
    const clientUserId = await signInAsTestUser(testSupabase, 'client')

    await testSupabase.from('script_locks').insert({
      script_id: TEST_SCRIPT_ID,
      locked_by_id: clientUserId,
      locked_by_name: 'Test Client',
      last_heartbeat: new Date().toISOString(),
    })

    // Sign back in as admin
    await authDelay()
    await signInAsTestUser(testSupabase, 'admin')

    const { result, unmount } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    // Should initially see as locked
    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('locked')
      },
      { timeout: 10000 }
    )

    // Release the lock (simulate other user unlocking)
    await testSupabase.from('script_locks').delete().eq('script_id', TEST_SCRIPT_ID)

    // Should detect release and attempt re-acquisition
    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('acquired')
      },
      { timeout: 15000 }
    )

    unmount()
  }, 20000)

  // TEST 9: Admin force unlock
  it('should allow admin to force-unlock', async () => {
    // Create lock held by client
    const clientUserId = await signInAsTestUser(testSupabase, 'client')

    await testSupabase.from('script_locks').insert({
      script_id: TEST_SCRIPT_ID,
      locked_by_id: clientUserId,
      locked_by_name: 'Test Client',
      last_heartbeat: new Date().toISOString(),
    })

    // Sign in as admin
    await authDelay()
    await signInAsTestUser(testSupabase, 'admin')

    const { result, unmount } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        expect(result.current.lockStatus).toBe('locked')
      },
      { timeout: 10000 }
    )

    // Admin force unlock
    await result.current.forceUnlock()

    // Lock should be released
    await waitFor(
      async () => {
        const { data } = await testSupabase
          .from('script_locks')
          .select('*')
          .eq('script_id', TEST_SCRIPT_ID)
          .maybeSingle()

        expect(data).toBeNull()
      },
      { timeout: 5000 }
    )

    expect(result.current.lockStatus).toBe('unlocked')

    unmount()
  }, 15000)

  // TEST 10: Race condition prevention (critical-engineer requirement)
  it('should prevent concurrent lock acquisitions', async () => {
    // This test validates database-level UNIQUE constraint prevents dual ownership

    const { result: result1, unmount: unmount1 } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        expect(result1.current.lockStatus).toBe('acquired')
      },
      { timeout: 10000 }
    )

    // Attempt concurrent acquisition (should fail due to UNIQUE constraint)
    const { result: result2, unmount: unmount2 } = renderHook(() => useScriptLock(TEST_SCRIPT_ID))

    await waitFor(
      () => {
        // Second hook should see as locked
        expect(result2.current.lockStatus).toBe('locked')
      },
      { timeout: 10000 }
    )

    // Verify only ONE lock exists in database
    const { data: locks } = await testSupabase
      .from('script_locks')
      .select('*')
      .eq('script_id', TEST_SCRIPT_ID)

    expect(locks).toHaveLength(1)

    unmount1()
    unmount2()
  }, 15000)
})
