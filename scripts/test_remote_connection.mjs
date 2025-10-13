import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function testConnection() {
  console.log('Testing remote Supabase connection...\n');

  // Test 1: Check projects
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id, title, eav_code')
    .eq('id', '68acab201777220d9e378d1d')
    .single();

  if (projectError) {
    console.error('Project query error:', projectError);
  } else {
    console.log('Project 68acab201777220d9e378d1d:', projects);
  }

  // Test 2: Check scripts
  const { data: scripts, error: scriptError } = await supabase
    .from('scripts')
    .select('*')
    .limit(1);

  if (scriptError) {
    console.error('Scripts query error:', scriptError);
  } else {
    console.log('\nScripts table accessible:', scripts ? 'YES' : 'NO');
  }

  process.exit(0);
}

testConnection();
