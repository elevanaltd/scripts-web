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
 * - Tests use 127.0.0.1:54321 automatically (undici localhost fix)
 * - Fast iteration without network latency
 *
 * **Test Users:**
 * Uses test users from supabase/create-test-users.sql or seed.sql
 *
 * // TESTGUARD consultation: Test infrastructure migration approved by holistic-orchestrator (B3_02)
 * // Validates through dependent test execution, not co-located tests
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

// Environment-aware Supabase URL
// Priority: Preview branch (CI) > Local (dev) > Remote (fallback)
// NOTE: Use 127.0.0.1 instead of localhost to avoid Node.js v22 + undici@5.29.0 fetch failures
// See: https://github.com/nodejs/undici/issues/2219
const SUPABASE_URL =
  process.env.SUPABASE_PREVIEW_URL || // CI: Preview branch
  (typeof window === 'undefined' ? 'http://127.0.0.1:54321' : undefined) || // Local: 127.0.0.1 (undici fix)
  import.meta.env.VITE_SUPABASE_URL || // Fallback: Remote
  'http://127.0.0.1:54321' // Ultimate fallback (undici fix)

// Environment-aware anon key
// For local development, use the key from `supabase status`
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PREVIEW_ANON_KEY || // CI: Preview branch key
  process.env.SUPABASE_ANON_KEY || // Local: From .env
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || // Fallback: Remote
  'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' // Local Supabase default from `supabase status`

/**
 * Fail-Fast Guard: Detect CI Misconfiguration
 *
 * **Issue**: Environment overrides (e.g., hardcoded URLs in package.json) can silently
 * break CI preview branch connection, causing tests to hang for 50+ minutes.
 *
 * **Solution**: Explicit validation that catches misconfigurations immediately.
 *
 * **Detection Logic**:
 * - If SUPABASE_PREVIEW_URL is set (CI environment)
 * - But resolved SUPABASE_URL contains 127.0.0.1 (localhost)
 * - Then package.json or another override is blocking preview connection
 *
 * **Impact**: Prevents silent regressions where future hardcoding causes CI hangs.
 *
 * **Constitutional Basis**:
 * - Principal-Engineer Strategic Enhancement: Prevent cross-app propagation
 * - MINIMAL_INTERVENTION: Fail fast with clear error message
 * - Anti-Validation Theater: Verify actual URL resolution, not just configuration
 *
 * **References**:
 * - PE Strategic Recommendations: Fail-fast guards prevent regression
 * - Root Cause: package.json override blocked CI preview connection
 */
if (process.env.SUPABASE_PREVIEW_URL && SUPABASE_URL.includes('127.0.0.1')) {
  throw new Error(
    'CI MISCONFIGURATION: SUPABASE_PREVIEW_URL is set but resolved URL is localhost. ' +
    'This indicates an environment override (likely in package.json) is preventing preview branch connection. ' +
    `Expected: ${process.env.SUPABASE_PREVIEW_URL}, Got: ${SUPABASE_URL}`
  )
}

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
 *
 * MIGRATION (2025-11-25): Updated to align with CI infrastructure
 * - OLD: test-admin@elevana.com (manual SQL creation, deprecated)
 * - NEW: admin.test@example.com (Auth Admin API via tests/setup/create-test-users.ts)
 *
 * Canonical Source: tests/setup/create-test-users.ts
 * Protocol: SUPABASE_PREVIEW_TESTING (v1.2.0)
 */
export const TEST_USERS = {
  admin: {
    email: 'admin.test@example.com',
    password: 'test-password-admin-123',
  },
  client: {
    email: 'client.test@example.com',
    password: 'test-password-client-123',
  },
  unauthorized: {
    email: 'unauthorized.test@example.com',
    password: 'test-password-unauth-123',
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
    isLocal: SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost'),
    isRemote: !SUPABASE_URL.includes('127.0.0.1') && !SUPABASE_URL.includes('localhost') && !process.env.SUPABASE_PREVIEW_URL,
  })
}
