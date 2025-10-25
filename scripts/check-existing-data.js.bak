#!/usr/bin/env node

/**
 * Check Existing Test Data
 * Find existing projects and videos we can use for testing
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

// Create admin client with service key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function checkExistingData() {
  console.log('🔍 Checking existing projects and videos...\n');

  // Check projects
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, title, eav_code, client_filter')
    .limit(5);

  if (projectsError) {
    console.error('❌ Projects error:', projectsError.message);
  } else {
    console.log('📋 Existing projects:');
    projects.forEach(p => {
      console.log(`  ${p.id}: ${p.title} (${p.eav_code}) - ${p.client_filter || 'no filter'}`);
    });
  }

  // Check videos
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id, title, eav_code, project_id')
    .limit(5);

  if (videosError) {
    console.error('❌ Videos error:', videosError.message);
  } else {
    console.log('\n🎥 Existing videos:');
    videos.forEach(v => {
      console.log(`  ${v.id}: ${v.title} (${v.eav_code}) - Project: ${v.project_id}`);
    });
  }

  // Check scripts
  const { data: scripts, error: scriptsError } = await supabase
    .from('scripts')
    .select('id, video_id, component_count')
    .limit(5);

  if (scriptsError) {
    console.error('❌ Scripts error:', scriptsError.message);
  } else {
    console.log('\n📝 Existing scripts:');
    scripts.forEach(s => {
      console.log(`  ${s.id}: Video ${s.video_id} - ${s.component_count} components`);
    });
  }

  // Check user_clients assignments
  const { data: userClients, error: clientsError } = await supabase
    .from('user_clients')
    .select('user_id, client_filter, granted_by');

  if (clientsError) {
    console.error('❌ User clients error:', clientsError.message);
  } else {
    console.log('\n👥 User client assignments:');
    userClients.forEach(uc => {
      console.log(`  User ${uc.user_id}: ${uc.client_filter} (granted by ${uc.granted_by})`);
    });
  }

  // Check if test-client-company exists in projects
  const { data: testProjects, error: testError } = await supabase
    .from('projects')
    .select('*')
    .eq('client_filter', 'test-client-company');

  if (testError) {
    console.error('❌ Test projects error:', testError.message);
  } else {
    console.log('\n🧪 Test projects (client_filter = test-client-company):');
    if (testProjects.length === 0) {
      console.log('  No projects found for test-client-company');
    } else {
      testProjects.forEach(p => {
        console.log(`  ${p.id}: ${p.title} (${p.eav_code})`);
      });
    }
  }
}

checkExistingData().catch(console.error);