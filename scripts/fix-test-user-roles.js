#!/usr/bin/env node

/**
 * Fix Test User Roles
 * Update existing test users to have correct roles for testing
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

async function updateUserRoles() {
  console.log('🔧 Updating test user roles...\n');

  // Get all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('❌ Could not list users:', usersError.message);
    return;
  }

  // Find test users
  const testAdmin = users.users.find(u => u.email === 'admin.test@example.com');
  const testClient = users.users.find(u => u.email === 'client.test@example.com');
  const testUnauthorized = users.users.find(u => u.email === 'test-unauthorized@external.com');

  if (!testAdmin || !testClient || !testUnauthorized) {
    console.error('❌ Not all test users found');
    return;
  }

  // 1. Set admin role
  console.log('🔧 Setting admin role...');
  const { error: adminError } = await supabase
    .from('user_profiles')
    .upsert({
      id: testAdmin.id,
      email: testAdmin.email,
      display_name: 'Test Admin User',
      role: 'admin',
      created_at: new Date().toISOString()
    });

  if (adminError) {
    console.error('❌ Admin profile error:', adminError.message);
  } else {
    console.log('✅ Admin profile updated');
  }

  // 2. Set client role
  console.log('🔧 Setting client role...');
  const { error: clientError } = await supabase
    .from('user_profiles')
    .upsert({
      id: testClient.id,
      email: testClient.email,
      display_name: 'Test Client User',
      role: 'client',
      created_at: new Date().toISOString()
    });

  if (clientError) {
    console.error('❌ Client profile error:', clientError.message);
  } else {
    console.log('✅ Client profile updated');
  }

  // 3. Remove unauthorized user profile (no role)
  console.log('🔧 Removing unauthorized user profile...');
  const { error: deleteError } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', testUnauthorized.id);

  if (deleteError) {
    console.error('❌ Delete profile error:', deleteError.message);
  } else {
    console.log('✅ Unauthorized user profile removed');
  }

  // 4. Create client assignment for test client
  console.log('🔧 Creating client assignment...');
  const { error: assignmentError } = await supabase
    .from('user_clients')
    .upsert({
      user_id: testClient.id,
      client_filter: 'test-client-company',
      granted_by: testAdmin.id,
      created_at: new Date().toISOString()
    });

  if (assignmentError) {
    console.error('❌ Client assignment error:', assignmentError.message);
  } else {
    console.log('✅ Client assignment created');
  }

  console.log('\n✅ User roles updated successfully!');
}

async function verifyRoles() {
  console.log('\n🔍 Verifying user roles...\n');

  const testUsers = [
    { email: 'admin.test@example.com', expectedRole: 'admin' },
    { email: 'client.test@example.com', expectedRole: 'client' },
    { email: 'test-unauthorized@external.com', expectedRole: null }
  ];

  for (const testUser of testUsers) {
    try {
      // Sign in as test user
      const testClient = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

      const { data: authData, error: authError } = await testClient.auth.signInWithPassword({
        email: testUser.email,
        password: `${testUser.email.split('@')[0]}-password-123`
      });

      if (authError) {
        console.log(`❌ ${testUser.email}: Sign-in failed`);
        continue;
      }

      // Check profile
      const { data: profile, error: profileError } = await testClient
        .from('user_profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.log(`❌ ${testUser.email}: Profile error`);
      } else if (!profile && testUser.expectedRole === null) {
        console.log(`✅ ${testUser.email}: No profile (correct for unauthorized)`);
      } else if (profile && profile.role === testUser.expectedRole) {
        console.log(`✅ ${testUser.email}: Role ${profile.role} (correct)`);
      } else {
        console.log(`❌ ${testUser.email}: Role mismatch. Expected: ${testUser.expectedRole}, Got: ${profile?.role}`);
      }

      await testClient.auth.signOut();

    } catch (error) {
      console.log(`❌ ${testUser.email}: Verification failed`);
    }
  }
}

async function main() {
  console.log('🚀 EAV Orchestrator - Fix Test User Roles\n');

  await updateUserRoles();
  await verifyRoles();

  console.log('\n💡 You can now run: npm test -- src/lib/comments.test.ts');
}

main().catch(console.error);