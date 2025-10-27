#!/usr/bin/env node

/**
 * Check Comments Table Status
 * Verifies if the comments table migration has been applied
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

// Create admin client with service key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function checkCommentsTable() {
  console.log('🔍 Checking comments table status...\n');

  try {
    // 1. Check if comments table exists
    const { data: tableExists, error: tableError } = await supabase
      .from('comments')
      .select('count', { count: 'exact', head: true });

    if (tableError) {
      console.error('❌ Comments table does not exist or is inaccessible');
      console.error('Error:', tableError.message);
      console.log('\n💡 Run migration: supabase/migrations/20250929030000_create_comments_table_corrected_schema.sql');
      return false;
    }

    console.log('✅ Comments table exists');

    // 2. Check table structure
    const { data: structureData, error: structureError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'comments' AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });

    if (structureError) {
      console.error('❌ Could not fetch table structure:', structureError.message);
    } else {
      console.log('\n📋 Table structure:');
      structureData.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    // 3. Check indexes
    const { data: indexData, error: indexError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE tablename = 'comments' AND schemaname = 'public'
          ORDER BY indexname;
        `
      });

    if (indexError) {
      console.error('❌ Could not fetch indexes:', indexError.message);
    } else {
      console.log('\n🗂️  Indexes:');
      indexData.forEach(idx => {
        console.log(`  ${idx.indexname}`);
      });
    }

    // 4. Check RLS policies
    const { data: policyData, error: policyError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT policyname, cmd, roles, qual, with_check
          FROM pg_policies
          WHERE tablename = 'comments' AND schemaname = 'public'
          ORDER BY policyname;
        `
      });

    if (policyError) {
      console.error('❌ Could not fetch RLS policies:', policyError.message);
    } else {
      console.log('\n🔒 RLS Policies:');
      policyData.forEach(policy => {
        console.log(`  ${policy.policyname} (${policy.cmd})`);
      });
    }

    return true;

  } catch (error) {
    console.error('❌ Error checking comments table:', error);
    return false;
  }
}

async function checkTestUsers() {
  console.log('\n👥 Checking test users...\n');

  const testEmails = [
    'admin.test@example.com',
    'client.test@example.com',
    'test-unauthorized@external.com'
  ];

  for (const email of testEmails) {
    try {
      const { data, error } = await supabase.auth.admin.listUsers();

      if (error) {
        console.error(`❌ Could not list users: ${error.message}`);
        continue;
      }

      const user = data.users.find(u => u.email === email);

      if (user) {
        console.log(`✅ ${email} exists (ID: ${user.id})`);

        // Check if user has profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.log(`  ⚠️  No user profile found`);
        } else {
          console.log(`  📋 Role: ${profile.role}`);
        }
      } else {
        console.log(`❌ ${email} does not exist`);
      }
    } catch (error) {
      console.error(`❌ Error checking ${email}:`, error);
    }
  }
}

async function main() {
  console.log('🚀 EAV Orchestrator - Comments Infrastructure Check\n');

  const tableOk = await checkCommentsTable();
  await checkTestUsers();

  if (tableOk) {
    console.log('\n✅ Comments table is ready!');
    console.log('💡 Next: Create test users to enable integration tests');
  } else {
    console.log('\n❌ Comments table needs setup');
    console.log('💡 Apply migration first, then create test users');
  }
}

main().catch(console.error);