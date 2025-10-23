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
 */

import type { SupabaseClient, Session } from '@supabase/supabase-js'
import type { Database } from '@elevanaltd/shared-lib/types'

/**
 * Test User Credentials
 * Standardized across all test files for consistency
 */
export const TEST_USERS = {
  ADMIN: {
    email: 'test-admin@elevana.com',
    password: 'test-admin-password-123',
  },
  CLIENT: {
    email: 'test-client@external.com',
    password: 'test-client-password-123',
  },
  UNAUTHORIZED: {
    email: 'test-unauthorized@external.com',
    password: 'test-unauthorized-password-123',
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
 * Falls back to sign out + refresh if setSession fails (CI compatibility).
 * Validates session expiration and re-authenticates if needed.
 *
 * @param client - Supabase client instance
 * @param session - Cached session to activate
 * @throws Error if session setting fails
 *
 * @example
 * ```typescript
 * test('admin can create comment', async () => {
 *   await switchToSession(client, adminSession);
 *   const comment = await createComment(...);
 *   expect(comment).toBeDefined();
 * });
 *
 * test('client has limited access', async () => {
 *   await switchToSession(client, clientSession);
 *   const result = await attemptAdminAction();
 *   expect(result.error).toBeDefined();
 * });
 * ```
 */
export async function switchToSession(
  client: SupabaseClient<Database>,
  session: Session
): Promise<void> {
  // Check if session is expired or near expiration
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at || 0;
  const isExpired = now >= expiresAt;
  const isNearExpiry = (expiresAt - now) < 60; // Less than 60 seconds remaining

  if (isExpired || isNearExpiry) {
    // Session expired or about to expire - try refreshing first
    await client.auth.signOut();

    const { data: refreshData, error: refreshError } = await client.auth.refreshSession({
      refresh_token: session.refresh_token,
    });

    if (!refreshError && refreshData.session) {
      // Update the cached session object with new tokens
      session.access_token = refreshData.session.access_token;
      session.refresh_token = refreshData.session.refresh_token;
      session.expires_at = refreshData.session.expires_at;
      return;
    }

    // Refresh failed - session is truly invalid
    throw new Error(
      `Session expired and refresh failed. Re-authentication required.\n` +
      `Error: ${refreshError?.message || 'Unknown refresh error'}\n` +
      `Hint: Call authenticateAndCache() again to obtain a fresh session.`
    );
  }

  // Session is valid - proceed with normal switching
  const { error: setError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  // If setSession succeeds, we're done
  if (!setError) {
    return;
  }

  // Fallback for CI environments: Sign out and use refreshSession
  // This handles cases where setSession fails due to session context issues
  await client.auth.signOut();

  const { data: refreshData, error: refreshError } = await client.auth.refreshSession({
    refresh_token: session.refresh_token,
  });

  if (refreshError) {
    throw new Error(
      `Failed to switch session (both setSession and refreshSession failed):\n` +
      `setSession: ${setError.message}\n` +
      `refreshSession: ${refreshError.message}\n` +
      `Hint: Session may be expired. Call authenticateAndCache() to obtain a fresh session.`
    );
  }

  // Update cached session with refreshed tokens
  if (refreshData.session) {
    session.access_token = refreshData.session.access_token;
    session.refresh_token = refreshData.session.refresh_token;
    session.expires_at = refreshData.session.expires_at;
  }
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
