#!/usr/bin/env node

/**
 * Test RLS policies causing 406 errors
 * This script tests with both service role and authenticated user
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse .env file
const envContent = readFileSync(join(__dirname, '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length) {
    env[key.trim()] = value.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;

async function testWithServiceRole() {
  console.log('\n=== Testing with Service Role (no RLS) ===\n');

  const supabase = createClient(supabaseUrl, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false }
  });

  // Get first script
  const { data: scripts, error } = await supabase
    .from('scripts')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error fetching scripts:', error);
    return null;
  }

  if (!scripts || scripts.length === 0) {
    console.log('No scripts found');
    return null;
  }

  const script = scripts[0];
  console.log('✅ Found script:', script.id);

  // Test RPC
  const { data: rpcData, error: rpcError, status } = await supabase
    .rpc('save_script_with_components', {
      p_script_id: script.id,
      p_yjs_state: null,
      p_plain_text: 'Service role test',
      p_components: []
    });

  console.log('  RPC Status:', status);
  if (rpcError) {
    console.error('❌ RPC Error:', rpcError);
  } else {
    console.log('✅ RPC Success');
  }

  return script.id;
}

async function testWithAuth(scriptId) {
  console.log('\n=== Testing with Authenticated User (with RLS) ===\n');

  const supabase = createClient(
    supabaseUrl,
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
  );

  // Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'test123456'
  });

  if (authError) {
    console.error('❌ Auth failed:', authError.message);
    console.log('  Creating test user...');

    // Try to create user
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'test123456',
      options: {
        data: { role: 'admin' }
      }
    });

    if (signupError) {
      console.error('❌ Signup failed:', signupError.message);
      return;
    }

    console.log('✅ User created');
  } else {
    console.log('✅ Signed in as:', authData.user.email);
  }

  // Check user role
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', authData?.user?.id || '')
    .single();

  if (!profileError && profile) {
    console.log('  User role:', profile.role || 'none');
  }

  // Test fetching scripts
  console.log('\n1. Testing script fetch...');
  const { data: scripts, error: fetchError, status: fetchStatus } = await supabase
    .from('scripts')
    .select('*')
    .eq('id', scriptId)
    .single();

  console.log('  Fetch Status:', fetchStatus);
  if (fetchError) {
    console.error('❌ Fetch Error:', fetchError);
  } else {
    console.log('✅ Script fetched successfully');
  }

  // Test RPC
  console.log('\n2. Testing RPC save_script_with_components...');
  const { data: rpcData, error: rpcError, status: rpcStatus } = await supabase
    .rpc('save_script_with_components', {
      p_script_id: scriptId,
      p_yjs_state: null,
      p_plain_text: 'Auth user test',
      p_components: []
    });

  console.log('  RPC Status:', rpcStatus);
  if (rpcError) {
    console.error('❌ RPC Error:', rpcError);
    console.error('  Error details:', JSON.stringify(rpcError, null, 2));
  } else {
    console.log('✅ RPC Success');
    console.log('  Returned:', rpcData);
  }

  // Test direct update
  console.log('\n3. Testing direct update...');
  const { data: updateData, error: updateError, status: updateStatus } = await supabase
    .from('scripts')
    .update({ plain_text: 'Direct update test' })
    .eq('id', scriptId)
    .select()
    .single();

  console.log('  Update Status:', updateStatus);
  if (updateError) {
    console.error('❌ Update Error:', updateError);
  } else {
    console.log('✅ Update Success');
  }
}

async function main() {
  console.log('=== RLS 406 Error Diagnosis ===');
  console.log('Supabase URL:', supabaseUrl);

  // First test with service role
  const scriptId = await testWithServiceRole();

  if (scriptId) {
    // Then test with auth user
    await testWithAuth(scriptId);
  }

  console.log('\n=== Analysis Complete ===');
  console.log('\nIf service role works but auth user gets 406:');
  console.log('→ RLS policies are blocking the operation');
  console.log('→ Check that user has proper role in user_profiles');
  console.log('→ Check RLS policies on scripts table');
  console.log('→ The 406 likely means "request format ok, but RLS denied"');
}

main().catch(console.error);