#!/usr/bin/env node

/**
 * Test Comment Creation
 * Debug RLS policies for comments table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const TEST_SCRIPT_ID = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680';

async function testCommentCreation() {
  console.log('🧪 Testing comment creation with different clients...\n');

  // 1. Test with service key (should always work)
  console.log('1. Testing with service key (bypasses RLS)...');
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  const { data: serviceComment, error: serviceError } = await serviceClient
    .from('comments')
    .insert({
      script_id: TEST_SCRIPT_ID,
      user_id: '8dd2e27e-876f-43ea-a348-4ef0150800b9', // test-admin user ID
      content: 'Test comment via service key',
      start_position: 0,
      end_position: 10
    })
    .select()
    .single();

  if (serviceError) {
    console.log('❌ Service key failed:', serviceError.message);
  } else {
    console.log('✅ Service key success:', serviceComment.id);
  }

  // 2. Test with admin user
  console.log('\n2. Testing with admin user...');
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { error: authError } = await adminClient.auth.signInWithPassword({
    email: 'test-admin@elevana.com',
    password: 'test-admin-password-123'
  });

  if (authError) {
    console.log('❌ Admin auth failed:', authError.message);
    return;
  }

  const { data: adminUser } = await adminClient.auth.getUser();
  console.log('Admin user ID:', adminUser.user?.id);

  // Check admin user's profile
  const { data: adminProfile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('*')
    .eq('id', adminUser.user?.id)
    .single();

  if (profileError) {
    console.log('❌ Admin profile error:', profileError.message);
  } else {
    console.log('Admin profile:', adminProfile);
  }

  // Try to create comment as admin
  const { data: adminComment, error: adminError } = await adminClient
    .from('comments')
    .insert({
      script_id: TEST_SCRIPT_ID,
      user_id: adminUser.user?.id,
      content: 'Test comment via admin user',
      start_position: 5,
      end_position: 15
    })
    .select()
    .single();

  if (adminError) {
    console.log('❌ Admin comment failed:', adminError.message);
    console.log('Error details:', adminError);
  } else {
    console.log('✅ Admin comment success:', adminComment.id);
  }

  // Cleanup service key comment
  if (serviceComment) {
    await serviceClient.from('comments').delete().eq('id', serviceComment.id);
  }
  if (adminComment) {
    await adminClient.from('comments').delete().eq('id', adminComment.id);
  }

  await adminClient.auth.signOut();
}

testCommentCreation().catch(console.error);