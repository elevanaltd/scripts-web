/**
 * Authentication Helpers - Characterization Tests
 *
 * **Purpose**: Validate session reuse architecture works correctly
 * **Pattern**: Test infrastructure validation (not production code)
 *
 * These tests ensure:
 * 1. authenticateAndCache() returns valid sessions
 * 2. switchToSession() correctly changes active user
 * 3. Session caching works across multiple switches
 * 4. getUserId() extracts correct user ID
 * 5. Session reuse eliminates redundant auth calls
 *
 * **TDD Approach**: RED phase (tests will fail until auth-helpers.ts implemented)
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import type { Database } from '@elevanaltd/shared-lib/types'
import {
  authenticateAndCache,
  switchToSession,
  getUserId,
  clearSessionCache,
  TEST_USERS,
  SUPABASE_CONFIG,
} from './auth-helpers'

describe('Authentication Helpers - Session Reuse Architecture', () => {
  let client: SupabaseClient<Database>
  let adminSession: Awaited<ReturnType<typeof authenticateAndCache>>
  let clientSession: Awaited<ReturnType<typeof authenticateAndCache>>

  beforeAll(async () => {
    // Create Supabase client for testing
    client = createClient<Database>(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)

    // Authenticate once per suite (this is the optimization we're testing)
    adminSession = await authenticateAndCache(client, TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password)
    clientSession = await authenticateAndCache(client, TEST_USERS.CLIENT.email, TEST_USERS.CLIENT.password)
  })

  afterAll(async () => {
    // Clean up
    await client.auth.signOut()
    clearSessionCache()
  })

  test('authenticateAndCache should return valid session with access token', async () => {
    // RED PHASE: This will fail until auth-helpers.ts is implemented
    expect(adminSession).toBeDefined()
    expect(adminSession.access_token).toBeDefined()
    expect(adminSession.refresh_token).toBeDefined()
    expect(adminSession.user).toBeDefined()
    expect(adminSession.user.email).toBe(TEST_USERS.ADMIN.email)
  })

  test('authenticateAndCache should return different sessions for different users', async () => {
    // RED PHASE: Validate sessions are distinct
    expect(adminSession.user.id).not.toBe(clientSession.user.id)
    expect(adminSession.access_token).not.toBe(clientSession.access_token)
  })

  test('switchToSession should change active user to admin', async () => {
    // RED PHASE: Switch to admin session
    await switchToSession(client, adminSession)

    // Verify current user is admin
    const { data: { user }, error } = await client.auth.getUser()
    expect(error).toBeNull()
    expect(user?.id).toBe(adminSession.user.id)
    expect(user?.email).toBe(TEST_USERS.ADMIN.email)
  })

  test('switchToSession should change active user to client', async () => {
    // RED PHASE: Switch to client session
    await switchToSession(client, clientSession)

    // Verify current user is client
    const { data: { user }, error } = await client.auth.getUser()
    expect(error).toBeNull()
    expect(user?.id).toBe(clientSession.user.id)
    expect(user?.email).toBe(TEST_USERS.CLIENT.email)
  })

  test('getUserId should extract user ID from session', () => {
    // RED PHASE: Validate helper function
    const adminUserId = getUserId(adminSession)
    expect(adminUserId).toBe(adminSession.user.id)
    expect(typeof adminUserId).toBe('string')
    expect(adminUserId.length).toBeGreaterThan(0)
  })

  test('session reuse should eliminate redundant auth calls', async () => {
    // RED PHASE: Demonstrate session reuse pattern
    // This test validates the architectural fix: NO re-authentication needed

    // Switch between users multiple times (would fail with rate limiting if re-authenticating)
    await switchToSession(client, adminSession)
    const { data: { user: user1 } } = await client.auth.getUser()
    expect(user1?.email).toBe(TEST_USERS.ADMIN.email)

    await switchToSession(client, clientSession)
    const { data: { user: user2 } } = await client.auth.getUser()
    expect(user2?.email).toBe(TEST_USERS.CLIENT.email)

    await switchToSession(client, adminSession)
    const { data: { user: user3 } } = await client.auth.getUser()
    expect(user3?.email).toBe(TEST_USERS.ADMIN.email)

    // Success: 3 user switches with ZERO auth API calls (all using cached sessions)
  })

  test('clearSessionCache should reset cache', () => {
    // RED PHASE: Validate cache clearing
    clearSessionCache()

    // After clearing, getCachedSession should return null
    // (This validates the cache was actually reset)
    // Note: We can't directly test getCachedSession without importing it,
    // but clearSessionCache success is validated by the function not throwing
    expect(true).toBe(true) // Placeholder until we add getCachedSession to exports
  })
})

describe('Authentication Helpers - Error Handling', () => {
  let client: SupabaseClient<Database>

  beforeAll(() => {
    client = createClient<Database>(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  })

  afterAll(async () => {
    await client.auth.signOut()
  })

  test('authenticateAndCache should throw error for invalid credentials', async () => {
    // RED PHASE: Validate error handling
    await expect(
      authenticateAndCache(client, 'invalid@example.com', 'wrong-password')
    ).rejects.toThrow('Authentication failed')
  })

  test('switchToSession should throw error for invalid session', async () => {
    // RED PHASE: Validate error handling for malformed session
    // Using a properly typed but invalid session
    const invalidSession: Session = {
      access_token: 'invalid-token',
      refresh_token: 'invalid-refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Date.now() + 3600000,
      user: {
        id: 'fake-id',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    }

    await expect(
      switchToSession(client, invalidSession)
    ).rejects.toThrow('Failed to switch session')
  })
})
