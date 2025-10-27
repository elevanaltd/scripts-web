#!/usr/bin/env node

/**
 * Test Client Permissions
 * Debug why client can create comments when they shouldn't
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const TEST_SCRIPT_ID = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680';

async function testClientPermissions() {
  console.log('🧪 Testing client user permissions...\n');

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in as client
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'client.test@example.com',
    password: 'test-password-client-123'
  });

  if (authError) {
    console.log('❌ Client auth failed:', authError.message);
    return;
  }

  console.log('✅ Client signed in:', authData.user.id);

  // Check client profile
  const { data: profile, error: profileError } = await client
    .from('user_profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.log('❌ Profile error:', profileError.message);
  } else {
    console.log('📋 Client profile:', profile);
  }

  // Check user_clients assignment
  const { data: userClients, error: clientsError } = await client
    .from('user_clients')
    .select('*')
    .eq('user_id', authData.user.id);

  if (clientsError) {
    console.log('❌ User clients error:', clientsError.message);
  } else {
    console.log('👥 User client assignments:', userClients);
  }

  // Try to create a comment
  console.log('\n🔧 Attempting to create comment as client...');
  const { data: comment, error: commentError } = await client
    .from('comments')
    .insert({
      script_id: TEST_SCRIPT_ID,
      user_id: authData.user.id,
      content: 'Client attempt to create comment',
      start_position: 0,
      end_position: 10
    })
    .select()
    .single();

  if (commentError) {
    console.log('❌ Comment creation failed (expected):', commentError.message);
    console.log('Error code:', commentError.code);
  } else {
    console.log('✅ Comment created (unexpected!):', comment.id);

    // Clean up
    await client.from('comments').delete().eq('id', comment.id);
  }

  await client.auth.signOut();
}

testClientPermissions().catch(console.error);