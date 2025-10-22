#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
  { email: 'test-admin@elevana.com', password: 'test-admin-password-123', role: 'admin', name: 'Test Admin User' },
  { email: 'test-client@external.com', password: 'test-client-password-123', role: 'client', name: 'Test Client User' },
  { email: 'test-unauthorized@external.com', password: 'test-unauthorized-password-123', role: 'client', name: 'Test Unauthorized User' }
];

// Delete existing users first
console.log('Cleaning existing test users...');
for (const user of users) {
  const { data: existing } = await adminClient.auth.admin.listUsers();
  const existingUser = existing.users.find(u => u.email === user.email);
  if (existingUser) {
    await adminClient.auth.admin.deleteUser(existingUser.id);
    console.log(`✅ Deleted existing ${user.email}`);
  }
}

// Create users via Auth API (proper way)
for (const user of users) {
  console.log(`\nCreating ${user.email}...`);

  const { data, error } = await adminClient.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { role: user.role }
  });

  if (error) {
    console.error(`❌ Failed:`, error.message);
    continue;
  }

  console.log(`✅ Created user ID: ${data.user.id}`);

  // Create user_profile
  const { error: profileError } = await adminClient
    .from('user_profiles')
    .upsert({
      id: data.user.id,
      email: user.email,
      display_name: user.name,
      role: user.role
    });

  if (profileError) {
    console.error(`❌ Profile failed:`, profileError.message);
  } else {
    console.log(`✅ Profile created for ${user.role}`);
  }
}

console.log('\n=== Verification ===');
const { data: profiles } = await adminClient.from('user_profiles').select('*');
console.log('User profiles:', profiles?.map(p => ({ email: p.email, role: p.role })));
