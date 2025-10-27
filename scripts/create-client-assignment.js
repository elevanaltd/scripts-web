#!/usr/bin/env node

/**
 * Create Client Assignment for Test User
 * Fix the client assignment with correct column name
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

// Create admin client with service key
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function createClientAssignment() {
  console.log('🔧 Creating client assignment for test user...\n');

  // Get test users
  const { data: users } = await supabase.auth.admin.listUsers();
  const testAdmin = users.users.find(u => u.email === 'admin.test@example.com');
  const testClient = users.users.find(u => u.email === 'client.test@example.com');

  if (!testAdmin || !testClient) {
    console.error('❌ Test users not found');
    return;
  }

  // Create client assignment with correct column name
  const { error: assignmentError } = await supabase
    .from('user_clients')
    .upsert({
      user_id: testClient.id,
      client_filter: 'test-client-company',
      granted_by: testAdmin.id,
      granted_at: new Date().toISOString()
    });

  if (assignmentError) {
    console.error('❌ Client assignment error:', assignmentError.message);
  } else {
    console.log('✅ Client assignment created successfully');
  }
}

createClientAssignment().catch(console.error);