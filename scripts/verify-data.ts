import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
);

async function verifyDataRelationships() {
  console.log('=== VERIFYING DATA RELATIONSHIPS ===\n');

  // 1. Check projects
  console.log('1. PROJECTS:');
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, title, eav_code')
    .order('title');

  if (projectsError) {
    console.error('Error fetching projects:', projectsError);
    return;
  }

  console.log(`Found ${projects?.length || 0} projects:`);
  projects?.forEach(p => {
    console.log(`  - ${p.title}: ID=${p.id}, EAV=${p.eav_code}`);
  });

  console.log('\n2. VIDEOS:');

  // 2. Check videos and their relationships
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id, title, eav_code')
    .order('title');

  if (videosError) {
    console.error('Error fetching videos:', videosError);
    return;
  }

  console.log(`Found ${videos?.length || 0} videos:`);

  // Group videos by eav_code
  const videosByEavCode = new Map<string, typeof videos>();
  videos?.forEach(v => {
    if (v.eav_code) {
      if (!videosByEavCode.has(v.eav_code)) {
        videosByEavCode.set(v.eav_code, []);
      }
      videosByEavCode.get(v.eav_code)?.push(v);
    }
  });

  // Display videos grouped by project
  projects?.forEach(p => {
    const projectVideos = videosByEavCode.get(p.eav_code) || [];
    console.log(`\n  Project: ${p.title} (${p.eav_code})`);
    if (projectVideos.length > 0) {
      projectVideos.forEach(v => {
        console.log(`    ✓ ${v.title} (ID: ${v.id})`);
      });
    } else {
      console.log('    (no videos)');
    }
  });

  // Check for orphaned videos (videos with eav_code that doesn't match any project)
  console.log('\n3. ORPHANED VIDEOS CHECK:');
  const projectEavCodes = new Set(projects?.map(p => p.eav_code));
  const orphanedVideos = videos?.filter(v => v.eav_code && !projectEavCodes.has(v.eav_code));

  if (orphanedVideos && orphanedVideos.length > 0) {
    console.log(`⚠️  Found ${orphanedVideos.length} orphaned videos:`);
    orphanedVideos.forEach(v => {
      console.log(`  - ${v.title}: EAV=${v.eav_code} (no matching project)`);
    });
  } else {
    console.log('✅ No orphaned videos found');
  }

  // Check for videos without eav_code
  console.log('\n4. VIDEOS WITHOUT EAV_CODE:');
  const unlinkedVideos = videos?.filter(v => !v.eav_code);

  if (unlinkedVideos && unlinkedVideos.length > 0) {
    console.log(`⚠️  Found ${unlinkedVideos.length} videos without eav_code:`);
    unlinkedVideos.forEach(v => {
      console.log(`  - ${v.title} (ID: ${v.id})`);
    });
  } else {
    console.log('✅ All videos have eav_code');
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

// Run verification
verifyDataRelationships().catch(console.error);