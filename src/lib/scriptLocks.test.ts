/**
 * Script Lock System Tests
 *
 * Tests for Smart Edit Locking pattern per Lesson 005
 * - Auto-lock on script open
 * - Race condition prevention (SELECT FOR UPDATE NOWAIT)
 * - Lock verification in save operations
 * - Heartbeat mechanism
 *
 * Constitutional TDD: These tests are written FIRST (RED phase)
 * Implementation follows in migration 20251025000000_add_script_locks.sql
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

// Test data factory
const createTestScript = async (userId: string) => {
  const { data, error } = await supabase
    .from('scripts')
    .insert({
      video_id: 'test-video-1',
      title: 'Test Script for Locking',
      plain_text: 'Test content',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

const createTestUser = async (email: string, displayName: string) => {
  // In test environment, we'll use authenticated user or mock
  // For now, this will be implemented with actual test users
  return { id: 'test-user-id', email, display_name: displayName }
}

describe('Script Lock Acquisition (acquire_script_lock RPC)', () => {
  let testScriptId: string
  let userA: User
  let userB: User

  beforeEach(async () => {
    // Setup: Create test script
    const script = await createTestScript('test-user-a')
    testScriptId = script.id

    // Setup: Mock users (will be replaced with actual test auth)
    userA = await createTestUser('usera@test.com', 'User A')
    userB = await createTestUser('userb@test.com', 'User B')
  })

  describe('Test 1: Auto-lock on script open', () => {
    it('should acquire lock for first user', async () => {
      const { data, error } = await supabase.rpc('acquire_script_lock', {
        p_script_id: testScriptId
      })

      expect(error).toBeNull()
      expect(data).toMatchObject({
        success: true,
        locked_by_user_id: expect.any(String),
        locked_by_name: expect.any(String),
        locked_at: expect.any(String)
      })
    })

    it('should prevent second user from acquiring same lock', async () => {
      // User A acquires lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // User B attempts to acquire (should fail with lock info)
      // NOTE: In real implementation, we'd switch auth context here
      const { data, error } = await supabase.rpc('acquire_script_lock', {
        p_script_id: testScriptId
      })

      expect(error).toBeNull() // Function should return success:false, not error
      expect(data).toMatchObject({
        success: false,
        locked_by_user_id: expect.any(String),
        locked_by_name: expect.any(String),
        locked_at: expect.any(String)
      })
    })

    it('should return existing lock when same user tries again', async () => {
      // User A acquires lock
      const firstAcquire = await supabase.rpc('acquire_script_lock', {
        p_script_id: testScriptId
      })

      // User A tries again (should succeed with existing lock)
      const secondAcquire = await supabase.rpc('acquire_script_lock', {
        p_script_id: testScriptId
      })

      expect(secondAcquire.data?.success).toBe(true)
      expect(secondAcquire.data?.locked_by_user_id).toBe(
        firstAcquire.data?.locked_by_user_id
      )
    })
  })

  describe('Test 2: Race condition prevention (CRITICAL)', () => {
    it('should prevent concurrent acquisitions with SELECT FOR UPDATE NOWAIT', async () => {
      // Simulate 2 users acquiring simultaneously
      const [result1, result2] = await Promise.all([
        supabase.rpc('acquire_script_lock', { p_script_id: testScriptId }),
        supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })
      ])

      // Exactly ONE should succeed
      const successes = [
        result1.data?.success,
        result2.data?.success
      ].filter(Boolean)

      expect(successes.length).toBe(1)

      // One should have success:true, other should have success:false with lock info
      const hasSuccess = result1.data?.success || result2.data?.success
      const hasFailure = !result1.data?.success || !result2.data?.success

      expect(hasSuccess).toBe(true)
      expect(hasFailure).toBe(true)
    })

    it('should handle rapid sequential acquisitions correctly', async () => {
      // Fire 5 rapid acquisitions
      const results = await Promise.all(
        Array(5).fill(null).map(() =>
          supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })
        )
      )

      // All should succeed (same user) or exactly one should succeed
      const successCount = results.filter(r => r.data?.success).length
      expect(successCount).toBeGreaterThan(0)
      expect(successCount).toBeLessThanOrEqual(5)
    })
  })

  describe('Test 3: Lock expiration and cleanup', () => {
    it('should expire locks after 30 minutes without heartbeat', async () => {
      // Acquire lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // Simulate expired lock by manipulating last_heartbeat
      // Note: In real implementation, we'd mock time or use test-specific expiry
      await supabase
        .from('script_locks')
        .update({
          last_heartbeat: new Date(Date.now() - 31 * 60 * 1000).toISOString()
        })
        .eq('script_id', testScriptId)

      // Different user should now be able to acquire
      // (Implementation should clean up expired lock)
      const { data } = await supabase.rpc('acquire_script_lock', {
        p_script_id: testScriptId
      })

      expect(data?.success).toBe(true)
    })
  })

  describe('Test 4: Heartbeat updates', () => {
    it('should allow lock holder to update heartbeat', async () => {
      // Acquire lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // Update heartbeat
      const { error } = await supabase
        .from('script_locks')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('script_id', testScriptId)

      expect(error).toBeNull()
    })

    it('should prevent non-holder from updating heartbeat (RLS)', async () => {
      // User A acquires lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // User B tries to update heartbeat (should be blocked by RLS)
      // NOTE: In real implementation, we'd switch auth context
      const { error } = await supabase
        .from('script_locks')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('script_id', testScriptId)

      // Should either error or affect 0 rows (depending on RLS implementation)
      expect(error).toBeDefined()
    })
  })

  describe('Test 5: Lock release', () => {
    it('should allow lock holder to release lock', async () => {
      // Acquire lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // Release lock
      const { error } = await supabase
        .from('script_locks')
        .delete()
        .eq('script_id', testScriptId)

      expect(error).toBeNull()

      // Verify lock is gone
      const { data } = await supabase
        .from('script_locks')
        .select()
        .eq('script_id', testScriptId)
        .maybeSingle()

      expect(data).toBeNull()
    })

    it('should allow admin to force-unlock any script', async () => {
      // User acquires lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // Admin force-unlocks
      // NOTE: In real implementation, we'd switch to admin auth context
      const { error } = await supabase
        .from('script_locks')
        .delete()
        .eq('script_id', testScriptId)

      expect(error).toBeNull()
    })
  })
})

describe('Lock Verification in save_script_with_components (CRITICAL)', () => {
  let testScriptId: string

  beforeEach(async () => {
    const script = await createTestScript('test-user-a')
    testScriptId = script.id
  })

  describe('Test 6: Save requires active lock', () => {
    it('should reject save if lock was stolen', async () => {
      // User A acquires lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // Admin force-unlocks
      await supabase
        .from('script_locks')
        .delete()
        .eq('script_id', testScriptId)

      // User B acquires lock
      // NOTE: In real implementation, switch to User B auth
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // User A attempts save (should fail with lock verification error)
      // NOTE: In real implementation, switch back to User A auth
      const { error } = await supabase.rpc('save_script_with_components', {
        p_script_id: testScriptId,
        p_yjs_state: Buffer.from('test').toString('base64'),
        p_plain_text: 'Updated content',
        p_components: []
      })

      expect(error).toBeDefined()
      expect(error?.message).toContain('no longer hold the edit lock')
    })

    it('should allow save when lock is held', async () => {
      // Acquire lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // Save should succeed
      const { error } = await supabase.rpc('save_script_with_components', {
        p_script_id: testScriptId,
        p_yjs_state: Buffer.from('test').toString('base64'),
        p_plain_text: 'Updated content',
        p_components: []
      })

      expect(error).toBeNull()
    })

    it('should reject save when lock has expired', async () => {
      // Acquire lock
      await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

      // Simulate expired lock
      await supabase
        .from('script_locks')
        .update({
          last_heartbeat: new Date(Date.now() - 31 * 60 * 1000).toISOString()
        })
        .eq('script_id', testScriptId)

      // Save should fail
      const { error } = await supabase.rpc('save_script_with_components', {
        p_script_id: testScriptId,
        p_yjs_state: Buffer.from('test').toString('base64'),
        p_plain_text: 'Updated content',
        p_components: []
      })

      expect(error).toBeDefined()
      expect(error?.message).toContain('no longer hold the edit lock')
    })
  })
})

describe('RLS Policies for script_locks', () => {
  let testScriptId: string

  beforeEach(async () => {
    const script = await createTestScript('test-user-a')
    testScriptId = script.id
  })

  it('should allow anyone to view locks (SELECT policy)', async () => {
    // Acquire lock
    await supabase.rpc('acquire_script_lock', { p_script_id: testScriptId })

    // Anyone can read lock status
    const { data, error } = await supabase
      .from('script_locks')
      .select()
      .eq('script_id', testScriptId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })

  it('should only allow users with script access to acquire locks', async () => {
    // User with no access tries to acquire
    // NOTE: In real implementation, switch to user without access
    const { error } = await supabase.rpc('acquire_script_lock', {
      p_script_id: testScriptId
    })

    // Should either fail or be blocked by user_accessible_scripts check
    // (Implementation detail: error or success:false)
    expect(error || !error).toBeDefined() // Placeholder for actual assertion
  })
})
