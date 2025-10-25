#!/usr/bin/env node

/**
 * Create Test Data for Comments Tests
 * Creates a test project, video, and script using service key (bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

// Create admin client with service key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function createTestData() {
  console.log('🏗️  Creating test data for comments tests...\n');

  const timestamp = Date.now();
  // Generate valid EAV code: EAV + 1-3 digits, max 6 chars total
  const randomNum = Math.floor(Math.random() * 999) + 1; // 1-999
  const testEavCode = `EAV${randomNum}`;

  try {
    // 1. Create test project
    console.log('📋 Creating test project...');
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        id: `test-project-${timestamp}`,
        title: 'Test Project for Comments',
        eav_code: testEavCode,
        client_filter: 'test-client-company'
      })
      .select()
      .single();

    if (projectError) {
      console.error('❌ Project creation failed:', projectError.message);
      return false;
    }
    console.log(`✅ Project created: ${project.id} (${testEavCode})`);

    // 2. Create test video
    console.log('🎥 Creating test video...');
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .insert({
        id: `test-video-${timestamp}`,
        title: 'Test Video for Comments',
        eav_code: testEavCode
      })
      .select()
      .single();

    if (videoError) {
      console.error('❌ Video creation failed:', videoError.message);
      return false;
    }
    console.log(`✅ Video created: ${video.id}`);

    // 3. Create test script (scripts table uses UUID for ID)
    console.log('📝 Creating test script...');
    const scriptId = randomUUID();
    const { data: script, error: scriptError } = await supabase
      .from('scripts')
      .insert({
        id: scriptId,
        video_id: video.id,
        plain_text: 'This is a test script with some content to comment on. It has multiple sentences for position testing.',
        component_count: 1
      })
      .select()
      .single();

    if (scriptError) {
      console.error('❌ Script creation failed:', scriptError.message);
      return false;
    }
    console.log(`✅ Script created: ${script.id}`);

    console.log('\n🎉 Test data created successfully!');
    console.log(`📋 Project: ${project.id}`);
    console.log(`🎥 Video: ${video.id}`);
    console.log(`📝 Script: ${script.id}`);
    console.log(`🏷️  EAV Code: ${testEavCode}`);

    return {
      project,
      video,
      script,
      eavCode: testEavCode
    };

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    return false;
  }
}

async function cleanupOldTestData() {
  console.log('🧹 Cleaning up old test data...\n');

  // Delete old test data (older than 1 hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Cleanup in reverse order (scripts -> videos -> projects)
  // Note: For scripts, we can't use LIKE with UUIDs, so just delete by created_at
  const { error: scriptsError } = await supabase
    .from('scripts')
    .delete()
    .lt('created_at', oneHourAgo);

  const { error: videosError } = await supabase
    .from('videos')
    .delete()
    .like('id', 'test-video-%')
    .lt('created_at', oneHourAgo);

  const { error: projectsError } = await supabase
    .from('projects')
    .delete()
    .like('id', 'test-project-%')
    .lt('created_at', oneHourAgo);

  if (scriptsError || videosError || projectsError) {
    console.log('⚠️  Some cleanup issues (this is normal if no old data exists)');
  } else {
    console.log('✅ Old test data cleaned up');
  }
}

async function main() {
  console.log('🚀 EAV Orchestrator - Test Data Setup\n');

  await cleanupOldTestData();
  const result = await createTestData();

  if (result) {
    console.log('\n💡 Test data is ready for comments tests!');
    console.log('💡 Use these values in your tests:');
    console.log(`   TEST_PROJECT_ID: "${result.project.id}"`);
    console.log(`   TEST_VIDEO_ID: "${result.video.id}"`);
    console.log(`   TEST_SCRIPT_ID: "${result.script.id}"`);
    console.log(`   TEST_EAV_CODE: "${result.eavCode}"`);
  } else {
    console.log('\n❌ Failed to create test data');
  }
}

main().catch(console.error);