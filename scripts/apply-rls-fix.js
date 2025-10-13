#!/usr/bin/env node

/**
 * Apply RLS Fix Migration
 * Apply the comments RLS fix to prevent client inserts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const migrationPath = './supabase/migrations/20250929040000_fix_comments_rls_client_insert.sql';

async function applyMigration() {
  console.log('🔧 Applying RLS fix migration...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  // Read migration file
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  // Split by comment sections and execute each policy separately
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.includes('VERIFICATION QUERIES'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim()) {
      console.log(`${i + 1}. Executing: ${statement.substring(0, 50)}...`);

      const { error } = await supabase.rpc('exec_sql', { query: statement });

      if (error) {
        console.log(`❌ Error:`, error.message);
        // Continue with other statements
      } else {
        console.log(`✅ Success`);
      }
    }
  }

  console.log('\n🎉 Migration application complete!');
}

applyMigration().catch(console.error);