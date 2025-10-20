/**
 * D1.3 Performance Benchmark - Component Seeding Script (REFERENCE IMPLEMENTATION)
 *
 * ⚠️  IMPORTANT: This script is a REFERENCE IMPLEMENTATION showing the intended
 *     TypeScript client workflow. It was NOT used for the 2025-10-20 D1.3 benchmark.
 *
 * Actual Seeding Method:
 *   The D1.3 benchmark was executed via MCP SQL commands with service-role
 *   credentials (bypassing RLS). See the "Seeding Commands" section in
 *   coordination/reports/005-REPORT-D1-3-PERFORMANCE-BENCHMARKS.md for the
 *   exact SQL statements used.
 *
 * Known Limitation:
 *   This script currently uses VITE_SUPABASE_PUBLISHABLE_KEY (anon key) which
 *   will FAIL under production RLS policies when inserting into videos, scripts,
 *   and script_components tables. To use this script, replace the anon key with
 *   SUPABASE_SERVICE_ROLE_KEY (never commit this to git).
 *
 * Future Enhancement:
 *   Configure this script to use service-role key via environment variable:
 *   const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
 *   const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 *
 * Purpose: Seed 500 components across 10 scripts for performance testing
 * Gate Requirement: D1.3 from 002-UNIVERSAL-EAV_SYSTEM-CHECKLIST.md line 74
 * Target: <50ms query latency with 500 components
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   VITE_SUPABASE_PUBLISHABLE_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuration
const SCRIPTS_COUNT = 10;
const COMPONENTS_PER_SCRIPT = 50; // Total: 500 components
const TEST_VIDEO_ID = 'd13-perf-test-video'; // Dedicated test video

interface SeedingStats {
  scriptsCreated: number;
  componentsCreated: number;
  errors: string[];
  scriptIds: string[];
}

async function seedComponents(): Promise<SeedingStats> {
  const stats: SeedingStats = {
    scriptsCreated: 0,
    componentsCreated: 0,
    errors: [],
    scriptIds: []
  };

  console.log('🚀 D1.3 Performance Benchmark - Component Seeding');
  console.log('================================================\n');
  console.log(`Configuration:`);
  console.log(`  Scripts: ${SCRIPTS_COUNT}`);
  console.log(`  Components per script: ${COMPONENTS_PER_SCRIPT}`);
  console.log(`  Total components: ${SCRIPTS_COUNT * COMPONENTS_PER_SCRIPT}`);
  console.log(`  Test video ID: ${TEST_VIDEO_ID}\n`);

  // Ensure test video exists (or create it)
  console.log('📋 Ensuring test video exists...');
  const { data: existingVideo } = await supabase
    .from('videos')
    .select('id')
    .eq('id', TEST_VIDEO_ID)
    .maybeSingle();

  if (!existingVideo) {
    console.log('   Creating test video...');
    const { error: videoError } = await supabase
      .from('videos')
      .insert({
        id: TEST_VIDEO_ID,
        title: 'D1.3 Performance Benchmark Test Video',
        eav_code: 'EAV1', // Use existing project or create one
        main_stream_status: 'test',
        production_type: 'benchmark'
      });

    if (videoError) {
      console.error('   ❌ Failed to create test video:', videoError.message);
      stats.errors.push(`Video creation: ${videoError.message}`);
      return stats;
    }
    console.log('   ✅ Test video created');
  } else {
    console.log('   ✅ Test video already exists');
  }

  // Seed scripts and components
  console.log('\n📝 Seeding scripts and components...\n');

  for (let scriptNum = 1; scriptNum <= SCRIPTS_COUNT; scriptNum++) {
    try {
      // Create script
      const { data: script, error: scriptError } = await supabase
        .from('scripts')
        .insert({
          video_id: TEST_VIDEO_ID,
          plain_text: `Performance test script ${scriptNum}`,
          status: 'draft',
          component_count: COMPONENTS_PER_SCRIPT
        })
        .select()
        .single();

      if (scriptError) {
        const errorMsg = `Script ${scriptNum}: ${scriptError.message}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        continue;
      }

      stats.scriptsCreated++;
      stats.scriptIds.push(script.id);

      // Create components for this script
      const components = Array.from({ length: COMPONENTS_PER_SCRIPT }, (_, i) => ({
        script_id: script.id,
        component_number: i + 1,
        content: `Component ${i + 1} content for performance testing. This is sample text to simulate real component data with reasonable length for database query performance measurement. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
        word_count: 28
      }));

      const { error: componentError } = await supabase
        .from('script_components')
        .insert(components);

      if (componentError) {
        const errorMsg = `Components for script ${scriptNum}: ${componentError.message}`;
        console.error(`   ❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
      } else {
        stats.componentsCreated += COMPONENTS_PER_SCRIPT;
        console.log(`   ✅ Script ${scriptNum}/10: Created ${COMPONENTS_PER_SCRIPT} components (ID: ${script.id.substring(0, 8)}...)`);
      }
    } catch (error) {
      const errorMsg = `Script ${scriptNum}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`   ❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }

  return stats;
}

async function main() {
  const startTime = Date.now();

  try {
    const stats = await seedComponents();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n================================================');
    console.log('📊 Seeding Summary');
    console.log('================================================\n');
    console.log(`✅ Scripts created: ${stats.scriptsCreated}/${SCRIPTS_COUNT}`);
    console.log(`✅ Components created: ${stats.componentsCreated}/${SCRIPTS_COUNT * COMPONENTS_PER_SCRIPT}`);
    console.log(`⏱️  Duration: ${duration}s`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered (${stats.errors.length}):`);
      stats.errors.forEach(error => console.log(`   - ${error}`));
    }

    if (stats.scriptsCreated > 0) {
      console.log('\n📋 Sample Script IDs (for benchmarking):');
      console.log(`   First: ${stats.scriptIds[0]}`);
      if (stats.scriptIds.length > 1) {
        console.log(`   Last:  ${stats.scriptIds[stats.scriptIds.length - 1]}`);
      }
    }

    console.log('\n✅ Seeding complete!');
    console.log('\nNext steps:');
    console.log('  1. Run benchmark queries using scripts/benchmark-queries.sql');
    console.log('  2. Use the sample script IDs above in your queries');
    console.log('  3. Document results in coordination/reports/005-REPORT-D1.3-PERFORMANCE-BENCHMARKS.md');

    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
