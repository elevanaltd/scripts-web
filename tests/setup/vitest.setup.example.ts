/**
 * Vitest Global Setup Example
 *
 * Protocol: SUPABASE_PREVIEW_TESTING (v1.0.0)
 * Purpose: Example integration of Auth Admin API test user creation
 * Pattern: Create users once before all tests, cleanup after all tests
 *
 * Usage:
 * 1. Rename to vitest.setup.ts
 * 2. Configure in vite.config.ts:
 *    test: {
 *      globalSetup: ['./tests/setup/vitest.setup.ts']
 *    }
 */

import { createTestUsers, cleanupTestUsers } from './create-test-users'

let testUserIds: string[] = []

/**
 * Global setup: Run before all tests
 */
export async function setup() {
  console.log('🔧 Setting up test environment...')

  try {
    // Create test users via Auth Admin API
    const users = await createTestUsers()
    testUserIds = [users.admin.id, users.client.id, users.unauthorized.id]

    console.log('✅ Test users created:')
    console.log(`   - Admin: ${users.admin.email}`)
    console.log(`   - Client: ${users.client.email}`)
    console.log(`   - Unauthorized: ${users.unauthorized.email}`)
  } catch (error) {
    console.error('❌ Failed to create test users:', error)
    throw error
  }
}

/**
 * Global teardown: Run after all tests
 */
export async function teardown() {
  console.log('🧹 Cleaning up test environment...')

  try {
    await cleanupTestUsers(testUserIds)
    console.log('✅ Test users cleaned up')
  } catch (error) {
    console.error('⚠️  Cleanup failed (non-critical):', error)
    // Don't throw - cleanup failures shouldn't break CI
  }
}
