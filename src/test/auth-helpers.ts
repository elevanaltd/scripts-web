/**
 * Shared Authentication Utilities for Test Suite
 *
 * **Problem Solved**: Rate limiting on Supabase Auth API in CI environment
 * - Previous: 40+ auth calls per test file × 5 files × 4 parallel threads = 200+ auth requests
 * - Supabase Auth Rate Limit: 30-60 requests/hour
 * - Result: CI failures with 429 "over_request_rate_limit" errors
 *
 * **Solution**: Session Reuse Architecture
 * - Authenticate ONCE per test suite (beforeAll)
 * - Reuse sessions by switching tokens (setSession)
 * - NO re-authentication needed per test
 * - Reduction: 200+ auth requests → 15 auth requests (92.5% reduction)
 *
 * **Constitutional Basis**:
 * - ERROR-TRIAGE-LOOP.md: Architectural fixes over symptom patches
 * - COMPLETION_THROUGH_SUBTRACTION: Minimal changes, maximum impact
 * - RLS Testing Integrity: Still validates real security boundaries (no mocking)
 *
 * **References**:
 * - Root Cause Analysis: coordination/reports/[ERROR-ARCHITECT-RATE-LIMIT-ANALYSIS]
 * - Strategy Decision: Session Reuse Architecture (Strategy 1)
 * - Pattern: Authenticate → Cache → Reuse → Validate
 *
 * // TESTGUARD consultation: Test infrastructure migration approved by holistic-orchestrator (B3_02)
 * // MIGRATION (2025-11-25): Updated credentials to align with CI Auth Admin API infrastructure
 */

import type { SupabaseClient, Session } from '@supabase/supabase-js'
import type { Database } from '@elevanaltd/shared-lib/types'

/**
 * Test User Credentials
 * Standardized across all test files for consistency
 *
 * MIGRATION (2025-11-25): Updated to align with CI infrastructure
 * - OLD: test-admin@elevana.com (manual SQL creation, deprecated)
 * - NEW: admin.test@example.com (Auth Admin API via tests/setup/create-test-users.ts)
 *
 * Canonical Source: tests/setup/create-test-users.ts
 * Protocol: SUPABASE_PREVIEW_TESTING (v1.2.0)
 */
export const TEST_USERS = {
  ADMIN: {
    email: 'admin.test@example.com',
    password: 'test-password-admin-123',
  },
  CLIENT: {
    email: 'client.test@example.com',
    password: 'test-password-client-123',
  },
  UNAUTHORIZED: {
    email: 'unauthorized.test@example.com',
    password: 'test-password-unauth-123',
  },
} as const

/**
 * Supabase Configuration
 * Uses environment variables set by vitest.config.ts
 */
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co',
  anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const

/**
 * Session Cache
 * Stores authenticated sessions for reuse across tests
 * Populated once per test suite in beforeAll hooks
 */
interface SessionCache {
  admin: Session | null
  client: Session | null
  unauthorized: Session | null
}

const sessionCache: SessionCache = {
  admin: null,
  client: null,
  unauthorized: null,
}

/**
 * Authenticate and Cache Session
 *
 * Performs ONE authentication and caches the session for reuse.
 * Call this in beforeAll hooks to populate the session cache.
 *
 * @param client - Supabase client instance
 * @param email - User email
 * @param password - User password
 * @returns Session object with access_token and refresh_token
 * @throws Error if authentication fails
 *
 * @example
 * ```typescript
 * describe('Test Suite', () => {
 *   let adminSession: Session;
 *
 *   beforeAll(async () => {
 *     adminSession = await authenticateAndCache(client, TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
 *   });
 * });
 * ```
 */
export async function authenticateAndCache(
  client: SupabaseClient<Database>,
  email: string,
  password: string
): Promise<Session> {
  // Authenticate with credentials
  // NOTE: signInWithPassword() both authenticates AND sets the session on the client
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(`Authentication failed for ${email}: ${error.message}`)
  }

  if (!data.session) {
    throw new Error(`No session returned for ${email}`)
  }

  // Cache the session based on user type
  if (email === TEST_USERS.ADMIN.email) {
    sessionCache.admin = data.session
  } else if (email === TEST_USERS.CLIENT.email) {
    sessionCache.client = data.session
  } else if (email === TEST_USERS.UNAUTHORIZED.email) {
    sessionCache.unauthorized = data.session
  }

  return data.session
}

/**
 * Switch to Cached Session
 *
 * Changes the active user by setting a cached session.
 * If session is invalid/expired, re-authenticates using stored credentials.
 *
 * @param client - Supabase client instance
 * @param session - Cached session to activate
 * @throws Error if session setting and re-authentication both fail
 *
 * @example
 * ```typescript
 * test('admin can create comment', async () => {
 *   await switchToSession(client, adminSession);
 *   const comment = await createComment(...);
 *   expect(comment).toBeDefined();
 * });
 * ```
 */
export async function switchToSession(
  client: SupabaseClient<Database>,
  session: Session
): Promise<void> {
  // Try setting the session directly
  const { error: setError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  // If setSession succeeds, we're done
  if (!setError) {
    return;
  }

  // setSession failed - try refresh fallback
  await client.auth.signOut();

  const { data: refreshData, error: refreshError } = await client.auth.refreshSession({
    refresh_token: session.refresh_token,
  });

  if (!refreshError && refreshData.session) {
    // Refresh succeeded - update session in place
    Object.assign(session, refreshData.session);
    return;
  }

  // Both failed - tokens are expired. Re-authenticate using stored credentials.
  // Find which user this session belongs to by comparing user IDs
  const userId = session.user.id;
  let email: string | undefined;
  let password: string | undefined;

  if (userId === sessionCache.admin?.user?.id) {
    email = TEST_USERS.ADMIN.email;
    password = TEST_USERS.ADMIN.password;
  } else if (userId === sessionCache.client?.user?.id) {
    email = TEST_USERS.CLIENT.email;
    password = TEST_USERS.CLIENT.password;
  } else if (userId === sessionCache.unauthorized?.user?.id) {
    email = TEST_USERS.UNAUTHORIZED.email;
    password = TEST_USERS.UNAUTHORIZED.password;
  }

  if (!email || !password) {
    throw new Error(
      `Failed to switch session - tokens expired and could not identify user for re-authentication.\n` +
      `userId: ${userId}\n` +
      `Hint: This session may not have been created via authenticateAndCache().`
    );
  }

  // Re-authenticate and update session
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.session) {
    throw new Error(
      `Failed to re-authenticate expired session:\n` +
      `Original error: ${setError.message}\n` +
      `Refresh error: ${refreshError?.message}\n` +
      `Re-auth error: ${authError?.message || 'No session returned'}`
    );
  }

  // Update session object with fresh credentials
  Object.assign(session, authData.session);
}

/**
 * Get User ID from Session
 *
 * Convenience helper to extract user ID from session.
 * Useful for assertions and test data creation.
 *
 * @param session - Cached session
 * @returns User UUID
 *
 * @example
 * ```typescript
 * const adminUserId = getUserId(adminSession);
 * expect(comment.user_id).toBe(adminUserId);
 * ```
 */
export function getUserId(session: Session): string {
  return session.user.id
}

/**
 * Clear Session Cache
 *
 * Resets the session cache. Useful for cleanup between test suites
 * or when testing session expiration scenarios.
 *
 * @example
 * ```typescript
 * afterAll(() => {
 *   clearSessionCache();
 * });
 * ```
 */
export function clearSessionCache(): void {
  sessionCache.admin = null
  sessionCache.client = null
  sessionCache.unauthorized = null
}

/**
 * Get Cached Session (for advanced scenarios)
 *
 * Retrieves a cached session without switching to it.
 * Useful for parallel test scenarios or session comparison tests.
 *
 * @param userType - Type of user session to retrieve
 * @returns Cached session or null if not yet authenticated
 *
 * @example
 * ```typescript
 * const adminSession = getCachedSession('admin');
 * if (!adminSession) {
 *   throw new Error('Admin session not initialized');
 * }
 * ```
 */
export function getCachedSession(userType: 'admin' | 'client' | 'unauthorized'): Session | null {
  return sessionCache[userType]
}
