const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load env file manually
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

// Initialize Supabase client
const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function checkVideo() {
  const videoId = '68c4c2fb3b727d8eeea79644';

  console.log(`Checking for video with ID: ${videoId}`);

  // Check if video exists
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single();

  if (videoError) {
    console.log('Video not found:', videoError.message);
    console.log('Error code:', videoError.code);
  } else {
    console.log('Video found:', video);
  }

  // Try to get script for this video
  const { data: script, error: scriptError } = await supabase
    .from('scripts')
    .select('*')
    .eq('video_id', videoId)
    .single();

  if (scriptError) {
    console.log('\nScript query error:', scriptError.message);
    console.log('Error code:', scriptError.code);
  } else {
    console.log('Script found:', script);
  }

  // Check if this is an RLS issue
  console.log('\nTrying direct scripts query without filter...');
  const { data: allScripts, error: allScriptsError, status } = await supabase
    .from('scripts')
    .select('id, video_id')
    .limit(5);

  if (allScriptsError) {
    console.log('All scripts query error:', allScriptsError.message);
    console.log('HTTP Status:', status);
  } else {
    console.log('Scripts in database:', allScripts);
  }
}

checkVideo().catch(console.error);