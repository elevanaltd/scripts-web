/**
 * Cascade Delete Performance Benchmark (TD-006)
 *
 * GOAL: Verify p95 <500ms for cascade delete operations
 *
 * OPTIMIZATIONS TESTED:
 * 1. Composite index (parent_comment_id, deleted, id)
 * 2. RLS InitPlan optimization (get_user_accessible_comment_ids)
 *
 * BASELINE: 601ms p95 (from Quest 1C analysis)
 * TARGET: <500ms p95 (22% improvement required)
 * EXPECTED: 360-420ms p95 (30-40% improvement)
 *
 * USAGE:
 *   npx tsx scripts/benchmarks/cascade-delete-benchmark.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@elevanaltd/shared-lib/types';

// Test configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Test users
const ADMIN_EMAIL = 'admin.test@example.com';
const ADMIN_PASSWORD = 'test-password-admin-123';

// Test data
const TEST_SCRIPT_ID = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680';

async function signInAsAdmin(client: SupabaseClient) {
  await client.auth.signOut();
  const { data, error } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  if (error) throw error;
  return data.user.id;
}

async function measureCascadeDelete(
  client: SupabaseClient,
  parentId: string
): Promise<number> {
  const start = performance.now();

  // Cascade delete via soft delete UPDATE
  await client
    .from('comments')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .or(`id.eq.${parentId},parent_comment_id.eq.${parentId}`);

  const end = performance.now();
  return end - start;
}

async function cleanupTestData(client: SupabaseClient) {
  // Hard delete test comments (admin bypass)
  await client.from('comments').delete().eq('script_id', TEST_SCRIPT_ID);
}

async function runBenchmark() {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY!);

  console.log('🔧 TD-006 Cascade Delete Performance Benchmark\n');
  console.log('BASELINE: 601ms p95 (Quest 1C)');
  console.log('TARGET: <500ms p95');
  console.log('EXPECTED: 360-420ms p95\n');

  try {
    const adminUserId = await signInAsAdmin(client);

    // Cleanup any existing test data
    await cleanupTestData(client);

    // Test scenario: 10 parent comments with 10 replies each (100 total comments)
    console.log('📊 Creating test dataset...');
    console.log('- 10 parent comments');
    console.log('- 10 replies per parent');
    console.log('- Total: 100 comments\n');

    // Note: Initial dataset not used; each iteration creates fresh parent+replies
    // This ensures consistent measurement without data accumulation

    // Run benchmark: 50 iterations
    console.log('⏱️  Running benchmark (50 iterations)...\n');
    const latencies: number[] = [];

    for (let i = 0; i < 50; i++) {
      // Recreate parent for each iteration
      const { data: parent } = await client.from('comments').insert({
        script_id: TEST_SCRIPT_ID,
        user_id: adminUserId,
        content: `Benchmark parent ${i}`,
        start_position: i * 10,
        end_position: i * 10 + 5
      }).select().single();

      if (!parent) continue;

      // Create 10 replies
      for (let j = 0; j < 10; j++) {
        await client.from('comments').insert({
          script_id: TEST_SCRIPT_ID,
          user_id: adminUserId,
          content: `Benchmark reply ${j}`,
          parent_comment_id: parent.id,
          start_position: 0,
          end_position: 5
        });
      }

      // Measure cascade delete
      const latency = await measureCascadeDelete(client, parent.id);
      latencies.push(latency);

      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/50 iterations`);
      }
    }

    // Calculate percentiles
    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const avg = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;

    // Calculate improvement vs baseline
    const baselineP95 = 601;
    const improvementPercent = ((baselineP95 - p95) / baselineP95) * 100;

    // Display results
    console.log('\n📈 Performance Results:\n');
    console.log(`  Average:  ${avg.toFixed(1)}ms`);
    console.log(`  P50:      ${p50.toFixed(1)}ms`);
    console.log(`  P95:      ${p95.toFixed(1)}ms ${p95 < 500 ? '✅' : '❌'} (target: <500ms)`);
    console.log(`  P99:      ${p99.toFixed(1)}ms`);
    console.log(`  Min:      ${Math.min(...latencies).toFixed(1)}ms`);
    console.log(`  Max:      ${Math.max(...latencies).toFixed(1)}ms`);

    console.log('\n🎯 Improvement vs Baseline:\n');
    console.log(`  Baseline P95:    ${baselineP95}ms`);
    console.log(`  Current P95:     ${p95.toFixed(1)}ms`);
    console.log(`  Improvement:     ${improvementPercent.toFixed(1)}% ${improvementPercent > 0 ? '🚀' : '⚠️'}`);
    console.log(`  Reduction:       ${(baselineP95 - p95).toFixed(1)}ms`);

    console.log('\n✅ Acceptance Criteria:\n');
    console.log(`  P50 <300ms:      ${p50 < 300 ? '✅ PASS' : '❌ FAIL'} (${p50.toFixed(1)}ms)`);
    console.log(`  P95 <500ms:      ${p95 < 500 ? '✅ PASS' : '❌ FAIL'} (${p95.toFixed(1)}ms)`);
    console.log(`  P99 <750ms:      ${p99 < 750 ? '✅ PASS' : '❌ FAIL'} (${p99.toFixed(1)}ms)`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await cleanupTestData(client);

    console.log('\n✨ Benchmark complete!\n');

    // Exit with appropriate code
    if (p95 < 500) {
      console.log('🎉 TARGET ACHIEVED: P95 <500ms\n');
      process.exit(0);
    } else {
      console.log('⚠️  TARGET NOT MET: P95 >=500ms\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run benchmark
runBenchmark();
