import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
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
    console.log('Script query error:', scriptError.message);
  } else {
    console.log('Script found:', script);
  }
}

checkVideo().catch(console.error);