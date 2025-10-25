/**
 * Supabase Test Client
 *
 * Provides test-specific Supabase client with environment-aware configuration.
 *
 * **Environment Strategy:**
 * - CI: Uses Supabase preview branch (auto-created per PR via GitHub integration)
 * - Local: Uses local Supabase instance (supabase start on port 54321)
 * - Fallback: Remote Supabase (for emergency manual testing only)
 *
 * **Preview Branch Benefits:**
 * - Isolated per PR (no test interference between PRs)
 * - Real RLS policies (validates actual security)
 * - Real realtime (validates subscriptions)
 * - Real migrations (validates schema changes)
 * - Auto cleanup (preview branch deleted on PR merge)
 *
 * **Local Development:**
 * - Run `supabase start` to spin up local instance
 * - Tests use localhost:54321 automatically
 * - Fast iteration without network latency
 *
 * **Test Users:**
 * Uses test users from supabase/create-test-users.sql or seed.sql
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@elevanaltd/shared-lib/types'

// Environment-aware Supabase URL
// Priority: Preview branch (CI) > Local (dev) > Remote (fallback)
const SUPABASE_URL =
  process.env.SUPABASE_PREVIEW_URL || // CI: Preview branch
  (typeof window === 'undefined' ? 'http://localhost:54321' : undefined) || // Local: localhost
  import.meta.env.VITE_SUPABASE_URL || // Fallback: Remote
  'http://localhost:54321' // Ultimate fallback

// Environment-aware anon key
// For local development, use the key from `supabase status`
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PREVIEW_ANON_KEY || // CI: Preview branch key
  process.env.SUPABASE_ANON_KEY || // Local: From .env
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || // Fallback: Remote
  'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' // Local Supabase default from `supabase status`

/**
 * Test Supabase client
 * Automatically uses preview branch (CI) or localhost (local dev)
 */
export const testSupabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)

/**
 * Test user credentials
 * These should exist in your test database (create-test-users.sql)
 */
export const TEST_USERS = {
  admin: {
    email: 'test-admin@elevana.com',
    password: 'test-admin-password-123',
  },
  client: {
    email: 'test-client@external.com',
    password: 'test-client-password-123',
  },
} as const

/**
 * Rate limit protection for auth operations
 * Supabase has auth rate limits, this prevents test failures
 */
let lastAuthTime = 0
const MIN_AUTH_DELAY_MS = 750

export async function authDelay() {
  const now = Date.now()
  const timeSinceLastAuth = now - lastAuthTime
  if (timeSinceLastAuth < MIN_AUTH_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_AUTH_DELAY_MS - timeSinceLastAuth))
  }
  lastAuthTime = Date.now()
}

/**
 * Sign in as test user with rate limit protection
 */
export async function signInAsTestUser(
  client: SupabaseClient,
  userType: keyof typeof TEST_USERS
): Promise<string> {
  await authDelay()

  // Sign out first to clear any existing session
  await client.auth.signOut()
  await authDelay()

  const { email, password } = TEST_USERS[userType]
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(`Failed to sign in as ${userType}: ${error.message}`)
  }

  if (!data.user) {
    throw new Error(`No user returned for ${userType}`)
  }

  return data.user.id
}

/**
 * Clean up test data
 * Safe to use in preview branches (isolated per PR)
 */
export async function cleanupTestData(client: SupabaseClient<Database>) {
  // Clean script_locks table
  await client.from('script_locks').delete().neq('script_id', '')

  // Note: Preview branches are ephemeral, so cleanup is optional
  // but good practice for local testing
}

/**
 * Log current environment for debugging
 */
export function logTestEnvironment() {
  console.log('Test Environment:', {
    url: SUPABASE_URL,
    isPreviewBranch: !!process.env.SUPABASE_PREVIEW_URL,
    isLocal: SUPABASE_URL.includes('localhost'),
    isRemote: !SUPABASE_URL.includes('localhost') && !process.env.SUPABASE_PREVIEW_URL,
  })
}
