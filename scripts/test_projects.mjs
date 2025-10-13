import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function testProjects() {
  // Check what projects exist with EAV006
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, eav_code')
    .eq('eav_code', 'EAV006')
    .limit(5);

  console.log('Projects with EAV006:', projects);

  // Check what projects exist in general
  const { data: allProjects, error: allError } = await supabase
    .from('projects')
    .select('id, title, eav_code')
    .order('eav_code')
    .limit(10);

  console.log('\nFirst 10 projects:', allProjects);
}

testProjects();
