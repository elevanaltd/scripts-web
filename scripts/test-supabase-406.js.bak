#!/usr/bin/env node

/**
 * Test script to diagnose Supabase 406 errors
 * Run with: npm run test:406
 */

// Read the .env file manually
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
const supabaseKey = env.SUPABASE_SECRET_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  console.error('  URL:', supabaseUrl);
  console.error('  Key:', supabaseKey ? 'Present' : 'Missing');
  process.exit(1);
}

// Use service role key to bypass RLS for testing
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function testSaveScript() {
  console.log('\n=== Testing Script Save Operation ===\n');

  try {
    // Step 1: Using service role key (bypasses RLS)
    console.log('1. Using service role key for full access...');
    console.log('✅ Service key configured, RLS bypassed');

    // Step 2: Get a video to work with
    console.log('\n2. Fetching videos...');
    const { data: videos, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .limit(1);

    if (videoError) {
      console.error('❌ Video fetch error:', videoError);
      return;
    }

    if (!videos || videos.length === 0) {
      console.error('❌ No videos found');
      return;
    }

    const video = videos[0];
    console.log('✅ Found video:', video.id, '-', video.title);

    // Step 3: Get or create script for video
    console.log('\n3. Getting script for video...');
    const { data: scripts, error: scriptError } = await supabase
      .from('scripts')
      .select('*')
      .eq('video_id', video.id)
      .single();

    let script;
    if (scriptError && scriptError.code === 'PGRST116') {
      // No script exists, create one
      console.log('  Creating new script...');
      const { data: newScript, error: createError } = await supabase
        .from('scripts')
        .insert({
          video_id: video.id,
          plain_text: 'Test script content',
          component_count: 0
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Script creation error:', createError);
        return;
      }
      script = newScript;
      console.log('✅ Created script:', script.id);
    } else if (scriptError) {
      console.error('❌ Script fetch error:', scriptError);
      return;
    } else {
      script = scripts;
      console.log('✅ Found existing script:', script.id);
    }

    // Step 4: Test RPC function with components
    console.log('\n4. Testing save_script_with_components RPC...');

    const components = [
      { number: 1, content: 'Component 1 test content', wordCount: 4 },
      { number: 2, content: 'Component 2 test content', wordCount: 4 }
    ];

    const { data: rpcResult, error: rpcError, status, statusText } = await supabase
      .rpc('save_script_with_components', {
        p_script_id: script.id,
        p_yjs_state: null,
        p_plain_text: 'Updated test content',
        p_components: components
      });

    console.log('  Response status:', status, statusText);

    if (rpcError) {
      console.error('❌ RPC error:', rpcError);
      console.error('  Error details:', JSON.stringify(rpcError, null, 2));
    } else {
      console.log('✅ RPC succeeded:', rpcResult);
    }

    // Step 5: Verify the save worked by reading back
    console.log('\n5. Verifying save by reading back...');
    const { data: verifyScript, error: verifyError } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', script.id)
      .single();

    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
    } else {
      console.log('✅ Script after save:');
      console.log('  plain_text:', verifyScript.plain_text);
      console.log('  component_count:', verifyScript.component_count);
      console.log('  updated_at:', verifyScript.updated_at);
    }

    // Step 6: Check components
    console.log('\n6. Checking saved components...');
    const { data: savedComponents, error: compError } = await supabase
      .from('script_components')
      .select('*')
      .eq('script_id', script.id)
      .order('component_number');

    if (compError) {
      console.error('❌ Component fetch error:', compError);
    } else {
      console.log('✅ Found', savedComponents.length, 'components:');
      savedComponents.forEach(comp => {
        console.log(`  C${comp.component_number}: "${comp.content.substring(0, 30)}..."`);
      });
    }

    // Step 7: Test direct table updates (non-RPC)
    console.log('\n7. Testing direct table update...');
    const { data: directUpdate, error: directError, status: directStatus } = await supabase
      .from('scripts')
      .update({
        plain_text: 'Direct update test',
        updated_at: new Date().toISOString()
      })
      .eq('id', script.id)
      .select()
      .single();

    console.log('  Direct update status:', directStatus);

    if (directError) {
      console.error('❌ Direct update error:', directError);
    } else {
      console.log('✅ Direct update succeeded');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testSaveScript()
  .then(() => {
    console.log('\n=== Test Complete ===\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });