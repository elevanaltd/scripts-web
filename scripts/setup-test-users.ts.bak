/**
 * Setup Test Users in Local Supabase
 *
 * Creates test users in local Supabase auth.users for integration testing.
 * Run this after `supabase start` but before running tests.
 *
 * Usage: npm run setup:test-users
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.types'

// Local Supabase configuration
const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
const SUPABASE_SERVICE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz' // Service role key bypasses RLS

// Test user credentials (must match comments.test.ts)
const TEST_USERS = [
  {
    email: 'test-admin@elevana.com',
    password: 'test-admin-password-123',
    role: 'admin',
    displayName: 'Test Admin'
  },
  {
    email: 'test-client@external.com',
    password: 'test-client-password-123',
    role: 'client',
    displayName: 'Test Client'
  },
  {
    email: 'test-unauthorized@external.com',
    password: 'test-unauthorized-password-123',
    role: null, // No role - unauthorized user
    displayName: 'Test Unauthorized'
  }
]

async function setupTestUsers() {
  const supabaseAnon = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  const supabaseService = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('🔧 Setting up test users in local Supabase...\n')

  for (const user of TEST_USERS) {
    try {
      // Try to sign in first (user might already exist)
      const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
        email: user.email,
        password: user.password
      })

      if (!signInError && signInData.user) {
        console.log(`✅ User already exists: ${user.email} (ID: ${signInData.user.id})`)

        // Check if profile exists, create if missing
        if (user.role) {
          const { data: existingProfile } = await supabaseService
            .from('user_profiles')
            .select('id')
            .eq('id', signInData.user.id)
            .single()

          if (!existingProfile) {
            const { error: profileError } = await supabaseService
              .from('user_profiles')
              .insert({
                id: signInData.user.id,
                email: user.email,
                role: user.role,
                display_name: user.displayName
              })

            if (profileError) {
              console.error(`  ⚠️  Failed to create profile for ${user.email}:`, profileError.message)
            } else {
              console.log(`  ✅ Created profile with role: ${user.role}`)
            }
          } else {
            console.log(`  ✅ Profile already exists with role`)
          }
        }

        await supabaseAnon.auth.signOut()
        continue
      }

      // User doesn't exist, create it
      const { data, error: signUpError } = await supabaseAnon.auth.signUp({
        email: user.email,
        password: user.password,
        options: {
          data: {
            display_name: user.displayName
          }
        }
      })

      if (signUpError) {
        console.error(`❌ Failed to create ${user.email}:`, signUpError.message)
        continue
      }

      if (!data.user) {
        console.error(`❌ No user returned for ${user.email}`)
        continue
      }

      console.log(`✅ Created user: ${user.email} (ID: ${data.user.id})`)

      // Create user_profile with role using service key (bypasses RLS)
      if (user.role) {
        const { error: profileError } = await supabaseService
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: user.email,
            role: user.role,
            display_name: user.displayName
          })

        if (profileError) {
          console.error(`  ⚠️  Failed to create profile for ${user.email}:`, profileError.message)
        } else {
          console.log(`  ✅ Created profile with role: ${user.role}`)
        }
      }

      // Sign out after creation
      await supabaseAnon.auth.signOut()

    } catch (error) {
      console.error(`❌ Error processing ${user.email}:`, error)
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log('\n✅ Test user setup complete!')
  console.log('\nYou can now run tests: npm run test')
}

// Run setup
setupTestUsers().catch(console.error)
