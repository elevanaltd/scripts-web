/**
 * Test User Creation via Supabase Auth Admin API
 *
 * Protocol: SUPABASE_PREVIEW_TESTING (v1.0.0)
 * Purpose: Create test users for integration testing using Auth Admin API
 * Pattern: TIER2 per-run data creation (NOT seed.sql baseline)
 *
 * SECURITY: Uses synthetic test emails only (.test domain)
 * AUTH: Auth Admin API maintains system integrity (auth.users + auth.identities)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/supabase'

export interface TestUser {
  id: string
  email: string
  role: 'admin' | 'client'
}

export interface TestUsers {
  admin: TestUser
  client: TestUser
  unauthorized: TestUser
}

/**
 * Create Supabase client with service role (admin privileges)
 */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY environment variable required for Auth Admin API'
    )
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Create test users via Auth Admin API
 *
 * Idempotent: Deletes existing test users first
 * Returns: User IDs and emails for test assertions
 */
export async function createTestUsers(): Promise<TestUsers> {
  const admin = createAdminClient()

  const testUserDefinitions = [
    {
      email: 'admin.test@example.com',
      password: 'test-password-admin-123',
      role: 'admin' as const,
      displayName: 'Test Admin User'
    },
    {
      email: 'client.test@example.com',
      password: 'test-password-client-123',
      role: 'client' as const,
      displayName: 'Test Client User'
    },
    {
      email: 'unauthorized.test@example.com',
      password: 'test-password-unauth-123',
      role: 'client' as const,
      displayName: 'Test Unauthorized User'
    }
  ]

  // Cleanup: Delete existing test users (idempotent)
  const { data: existingUsers } = await admin.auth.admin.listUsers()
  for (const def of testUserDefinitions) {
    const existing = existingUsers.users.find((u) => u.email === def.email)
    if (existing) {
      await admin.auth.admin.deleteUser(existing.id)
    }
  }

  // Create users via Auth Admin API (proper auth.users + auth.identities)
  const createdUsers: TestUser[] = []

  for (const def of testUserDefinitions) {
    const { data, error } = await admin.auth.admin.createUser({
      email: def.email,
      password: def.password,
      email_confirm: true, // Skip email verification for tests
      user_metadata: {
        display_name: def.displayName
      }
    })

    if (error) {
      throw new Error(`Failed to create user ${def.email}: ${error.message}`)
    }

    // Create user_profile in public schema
    const { error: profileError } = await admin.from('user_profiles').upsert({
      id: data.user.id,
      email: def.email,
      display_name: def.displayName,
      role: def.role
    })

    if (profileError) {
      throw new Error(
        `Failed to create profile for ${def.email}: ${profileError.message}`
      )
    }

    createdUsers.push({
      id: data.user.id,
      email: def.email,
      role: def.role
    })
  }

  // Create user_clients for client users (RLS testing)
  // Links client users to client_filter values (matches seed.sql client_filter)
  const clientUsers = createdUsers.filter((u) => u.role === 'client')

  if (clientUsers.length > 0) {
    const userClientsData = [
      {
        user_id: clientUsers[0].id, // First client
        client_filter: 'CLIENT_ALPHA' // Matches seed.sql project
      },
      {
        user_id: clientUsers[1]?.id, // Second client (unauthorized)
        client_filter: 'CLIENT_UNAUTHORIZED' // No matching projects
      }
    ].filter((uc) => uc.user_id) // Filter out undefined

    const { error: userClientsError } = await admin
      .from('user_clients')
      .upsert(userClientsData)

    if (userClientsError) {
      throw new Error(
        `Failed to create user_clients: ${userClientsError.message}`
      )
    }
  }

  return {
    admin: createdUsers[0],
    client: createdUsers[1],
    unauthorized: createdUsers[2]
  }
}

/**
 * Cleanup test users after tests complete
 *
 * Optional: Preview environments destroy on PR merge
 * Useful: For local testing to reset state
 */
export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  const admin = createAdminClient()

  for (const id of userIds) {
    // Delete user_clients first (FK to auth.users)
    await admin.from('user_clients').delete().eq('user_id', id)

    // Delete from user_profiles
    await admin.from('user_profiles').delete().eq('id', id)

    // Delete from auth.users (cascades to auth.identities)
    await admin.auth.admin.deleteUser(id)
  }
}

/**
 * Get authenticated client for test user
 *
 * Returns: Supabase client with user session for integration testing
 */
export async function getAuthenticatedClient(
  email: string,
  password: string
): Promise<SupabaseClient<Database>> {
  const url = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
  const anonKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY

  if (!anonKey) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY environment variable required')
  }

  const client = createClient<Database>(url, anonKey)

  const { error } = await client.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    throw new Error(`Failed to authenticate ${email}: ${error.message}`)
  }

  return client
}
