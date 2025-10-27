#!/usr/bin/env node

/**
 * Setup Test Users for Comments Integration Tests
 * Creates the test users required for TDD testing approach
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SECRET_KEY) {
  console.error('❌ SUPABASE_SECRET_KEY not found in environment');
  process.exit(1);
}

// Create admin client with service key
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

// Test user configurations
const TEST_USERS = [
  {
    email: 'admin.test@example.com',
    password: 'test-password-admin-123',
    role: 'admin',
    displayName: 'Test Admin User'
  },
  {
    email: 'client.test@example.com',
    password: 'test-password-client-123',
    role: 'client',
    displayName: 'Test Client User'
  },
  {
    email: 'test-unauthorized@external.com',
    password: 'test-unauthorized-password-123',
    role: null, // No role assigned = unauthorized
    displayName: 'Test Unauthorized User'
  }
];

async function createTestUser(userConfig) {
  console.log(`🔧 Setting up user: ${userConfig.email}...`);

  try {
    let userId;

    // 1. Try to create auth user, or get existing user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userConfig.email,
      password: userConfig.password,
      email_confirm: true // Auto-confirm for testing
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`  ⚠️  User already exists, finding existing user...`);

        // Get existing user
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => u.email === userConfig.email);

        if (!existingUser) {
          throw new Error('User exists but could not retrieve');
        }

        userId = existingUser.id;
        console.log(`  ✅ Found existing auth user: ${userId}`);
      } else {
        throw authError;
      }
    } else {
      userId = authData.user.id;
      console.log(`  ✅ Created new auth user: ${userId}`);
    }

    // 2. Create or update user profile (only if role is specified)
    if (userConfig.role) {
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          email: userConfig.email,
          display_name: userConfig.displayName,
          role: userConfig.role,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (profileError) {
        console.error(`  ❌ Profile creation failed:`, profileError.message);
        return false;
      }

      console.log(`  ✅ Profile created/updated with role: ${userConfig.role}`);
    } else {
      // For unauthorized users, ensure no profile exists
      await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      console.log(`  ✅ No role assigned (unauthorized user)`);
    }

    // 3. For client users, create a test client assignment
    if (userConfig.role === 'client') {
      const clientFilter = 'test-client-company';

      // Find an admin user to be the granting user
      const { data: adminProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (adminProfile) {
        const { error: clientError } = await supabase
          .from('user_clients')
          .upsert({
            user_id: userId,
            client_filter: clientFilter,
            granted_by: adminProfile.id,
            created_at: new Date().toISOString()
          });

        if (clientError && !clientError.message.includes('duplicate')) {
          console.error(`  ❌ Client assignment failed:`, clientError.message);
        } else {
          console.log(`  ✅ Client assignment created/updated: ${clientFilter}`);
        }
      }
    }

    return true;

  } catch (error) {
    console.error(`  ❌ Failed to setup ${userConfig.email}:`, error.message);
    return false;
  }
}

async function verifyTestUsers() {
  console.log('\n🔍 Verifying test user setup...\n');

  for (const userConfig of TEST_USERS) {
    try {
      // Try to sign in with the test user
      const testClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

      const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
        email: userConfig.email,
        password: userConfig.password
      });

      if (authError) {
        console.log(`❌ ${userConfig.email}: Sign-in failed - ${authError.message}`);
        continue;
      }

      console.log(`✅ ${userConfig.email}: Sign-in successful`);

      // Check profile
      const { data: profile, error: profileError } = await testClient
        .from('user_profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.log(`  ⚠️  Profile error: ${profileError.message}`);
      } else if (!profile) {
        console.log(`  📋 No profile (unauthorized user)`);
      } else {
        console.log(`  📋 Role: ${profile.role}`);
      }

      await testClient.auth.signOut();

    } catch (error) {
      console.log(`❌ ${userConfig.email}: Verification failed - ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 EAV Orchestrator - Test User Setup\n');

  console.log('Setting up test users for TDD integration tests...\n');

  let successCount = 0;
  for (const userConfig of TEST_USERS) {
    const success = await createTestUser(userConfig);
    if (success) successCount++;
  }

  console.log(`\n📊 Setup completed for ${successCount}/${TEST_USERS.length} test users`);

  // Verify all users can sign in
  await verifyTestUsers();

  if (successCount === TEST_USERS.length) {
    console.log('\n✅ All test users ready!');
    console.log('💡 You can now run: npm test -- src/lib/comments.test.ts');
  } else {
    console.log('\n⚠️  Some test users failed to setup');
    console.log('💡 Check the errors above and retry');
  }
}

main().catch(console.error);