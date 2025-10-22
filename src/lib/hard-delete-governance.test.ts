/**
 * Governed Hard-Delete Pathway - TDD Test File (Option C Architecture)
 *
 * PURPOSE: Validate TD-006 remediation - Restrictive FK + Governed Hard-Delete Pathway
 *
 * ARCHITECTURAL DECISION (principal-engineer approved):
 * - FK RESTRICT blocks accidental hard cascades (prevents data loss)
 * - Security-definer function provides GDPR/compliance pathway
 * - Soft-delete precondition enforced (must soft-delete first)
 * - All operations logged to audit table for accountability
 *
 * TEST METHODOLOGY:
 * - TDD RED phase: Tests written BEFORE migration implementation ✅
 * - Authenticated testing pattern (admin/client role validation)
 * - Rate limit prevention via auth delays (750ms MIN_AUTH_DELAY_MS)
 * - NO service key bypasses - validates real RLS security boundaries
 *
 * IMPLEMENTATION STATUS:
 * ✅ All 4 migrations applied successfully via Supabase MCP
 * ✅ FK constraint verified as RESTRICT (delete_rule confirmed)
 * ✅ Function exists and executes (tested via direct SQL)
 * ✅ Audit table created with proper RLS policies
 * ⏳ Tests marked .skip due to PostgREST schema cache lag (1-3min refresh time)
 *
 * SCHEMA CACHE ISSUE:
 * Supabase PostgREST requires time to refresh schema cache after migrations.
 * Tests will pass once cache refreshes (typically 1-3 minutes, or after project restart).
 * Function verified working via mcp__supabase__execute_sql direct execution.
 *
 * TO RUN TESTS AFTER SCHEMA CACHE REFRESH:
 * Remove .skip from describe() block and run: npm test -- hard-delete-governance.test.ts
 *
 * REFERENCES:
 * - TD-006 remediation task
 * - critical-engineer NO-GO ruling (dual cascade data loss risk)
 * - principal-engineer Option C approval (6-month HIGH viability)
 * - Migrations: supabase/migrations/202510211200*.sql
 * - Documentation: supabase/migrations/README.md
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { SUPABASE_CONFIG, TEST_USERS, mintJwt, makeRlsClient } from '../test/auth-helpers';

// Test configuration - following established RLS testing pattern
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const MINTED_MODE = Boolean(SUPABASE_CONFIG.jwtSecret);

// Conditional skip: Only run integration tests when Supabase environment is configured
const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const describeIfEnv = hasSupabaseEnv ? describe : describe.skip;

// Test user credentials (following established pattern)
const ADMIN_EMAIL = TEST_USERS.ADMIN.email;
const ADMIN_PASSWORD = TEST_USERS.ADMIN.password;
const CLIENT_EMAIL = TEST_USERS.CLIENT.email;
const CLIENT_PASSWORD = TEST_USERS.CLIENT.password;

// Test data - dynamically created in CI environment
let TEST_SCRIPT_ID: string;

// Minted-JWT clients (used when VITE_SUPABASE_JWT_SECRET is provided)
let supabaseAdmin!: SupabaseClient<Database>;
let supabaseClientUser!: SupabaseClient<Database>;
let adminUserIdResolved = '';
let clientUserIdResolved = '';

async function initMintedClients() {
  if (!MINTED_MODE || !SUPABASE_CONFIG.jwtSecret) return;
  const tmp = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const adminResp = await tmp.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (adminResp.error || !adminResp.data.user) throw new Error(`Failed to resolve admin ID: ${adminResp.error?.message}`);
  adminUserIdResolved = adminResp.data.user.id;
  await tmp.auth.signOut();
  const clientResp = await tmp.auth.signInWithPassword({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD });
  if (clientResp.error || !clientResp.data.user) throw new Error(`Failed to resolve client ID: ${clientResp.error?.message}`);
  clientUserIdResolved = clientResp.data.user.id;
  await tmp.auth.signOut();

  const adminJwt = await mintJwt({ sub: adminUserIdResolved, email: ADMIN_EMAIL, jwtSecret: SUPABASE_CONFIG.jwtSecret });
  const clientJwt = await mintJwt({ sub: clientUserIdResolved, email: CLIENT_EMAIL, jwtSecret: SUPABASE_CONFIG.jwtSecret });

  supabaseAdmin = makeRlsClient(SUPABASE_URL, SUPABASE_ANON_KEY, adminJwt);
  supabaseClientUser = makeRlsClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientJwt);
}

async function assumeAdmin(client: SupabaseClient<Database>): Promise<string> {
  if (MINTED_MODE) { return adminUserIdResolved; }
  // Legacy fallback
  await client.auth.signOut();
  const { data, error } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error || !data.user) throw error || new Error('No user');
  return data.user.id;
}

async function assumeClient(client: SupabaseClient<Database>): Promise<string> {
  if (MINTED_MODE) { return clientUserIdResolved; }
  await client.auth.signOut();
  const { data, error } = await client.auth.signInWithPassword({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD });
  if (error || !data.user) throw error || new Error('No user');
  return data.user.id;
}

// Helper to ensure test script exists
async function ensureTestScriptExists(client: SupabaseClient<Database>) {
  // Ensure admin context (minted mode uses admin client; legacy signs in)
  if (!MINTED_MODE) {
    const { error: authError } = await client.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    if (authError) {
      console.warn('Warning: Could not authenticate as admin for test data setup');
      TEST_SCRIPT_ID = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680';
      return;
    }
  }

  // Check if test script already exists
  const { data: existingScript } = await client
    .from('scripts')
    .select('id')
    .eq('id', '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680')
    .maybeSingle();

  if (existingScript) {
    TEST_SCRIPT_ID = existingScript.id;
  } else {
    // Create test script if it doesn't exist
    const { data: newScript, error: scriptError } = await client
      .from('scripts')
      .insert({
        id: '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680',
        video_id: '22222222-2222-2222-2222-222222222222',
        title: 'Test Script for Hard-Delete Governance',
        content: 'Test script content'
      })
      .select()
      .single();

    if (scriptError) {
      console.warn('Warning: Could not create test script:', scriptError);
      TEST_SCRIPT_ID = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680'; // Use fallback
    } else {
      TEST_SCRIPT_ID = newScript.id;
    }
  }
}

// INTEGRATION TEST - Requires Supabase (local or remote) with migrations + test users
// Function `hard_delete_comment_tree` must exist (verify: SELECT * FROM pg_proc WHERE proname = 'hard_delete_comment_tree')
// To run: Ensure local Supabase is running (`npx supabase start`) OR set remote credentials
describeIfEnv('Governed Hard-Delete Pathway (Option C Architecture)', () => {
  let client: SupabaseClient<Database>;
  let adminUserId: string;
  let testCommentIds: string[] = [];

  beforeEach(async () => {
    // Create client (single client pattern to avoid GoTrueClient conflicts)
    client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (MINTED_MODE && SUPABASE_CONFIG.jwtSecret) {
      await initMintedClients();
    }

    // Ensure test script exists (use admin client when minted mode)
    await ensureTestScriptExists(MINTED_MODE ? supabaseAdmin : client);

    // Use admin context to create test data
    adminUserId = await assumeAdmin(MINTED_MODE ? supabaseAdmin : client);

    // Create test comment tree (parent + 2 children)
    const { data: parentComment, error: parentError } = await (MINTED_MODE ? supabaseAdmin : client)
      .from('comments')
      .insert({
        script_id: TEST_SCRIPT_ID,
        user_id: adminUserId,
        content: 'Parent comment for hard-delete test',
        start_position: 0,
        end_position: 10,
        deleted: false
      })
      .select()
      .single();

    if (parentError || !parentComment) {
      throw new Error(`Failed to create parent comment: ${parentError?.message}`);
    }

    testCommentIds = [parentComment.id];

    // Create child comments
    const { data: childComments, error: childError } = await (MINTED_MODE ? supabaseAdmin : client)
      .from('comments')
      .insert([
        {
          script_id: TEST_SCRIPT_ID,
          user_id: adminUserId,
          parent_comment_id: parentComment.id,
          content: 'Child comment 1',
          start_position: 0,
          end_position: 5,
          deleted: false
        },
        {
          script_id: TEST_SCRIPT_ID,
          user_id: adminUserId,
          parent_comment_id: parentComment.id,
          content: 'Child comment 2',
          start_position: 5,
          end_position: 10,
          deleted: false
        }
      ])
      .select();

    if (childError || !childComments) {
      throw new Error(`Failed to create child comments: ${childError?.message}`);
    }

    testCommentIds.push(...childComments.map(c => c.id));
  });

  afterEach(async () => {
    // Cleanup: Hard-delete test comments (if function exists and auth succeeds)
    try {
      await assumeAdmin(MINTED_MODE ? supabaseAdmin : client);

      // Attempt soft-delete first
      await (MINTED_MODE ? supabaseAdmin : client).rpc('cascade_soft_delete_comments', {
        comment_ids: testCommentIds
      });

      // Attempt hard-delete (will fail gracefully if function doesn't exist yet - RED phase)
      for (const commentId of testCommentIds) {
        await (MINTED_MODE ? supabaseAdmin : client).rpc('hard_delete_comment_tree', {
          p_comment_id: commentId,
          p_reason: 'Test cleanup'
        });
      }
    } catch {
      // Ignore cleanup errors in RED phase (function doesn't exist yet)
      console.log('Test cleanup: hard_delete function not yet implemented (expected in RED phase)');
    }

    testCommentIds = [];
  });

  describe('FK RESTRICT Constraint (Migration 1)', () => {
    test('should prevent raw DELETE of parent comment when children exist', async () => {
      // RED: This test expects FK RESTRICT constraint to block direct DELETE
      await assumeAdmin(MINTED_MODE ? supabaseAdmin : client);

      const parentId = testCommentIds[0];

      // Attempt raw DELETE (should fail due to FK RESTRICT)
      const { error } = await (MINTED_MODE ? supabaseAdmin : client)
        .from('comments')
        .delete()
        .eq('id', parentId);

      // Expect FK constraint violation (PostgreSQL error code 23503)
      expect(error).toBeDefined();
      expect(error?.code).toBe('23503'); // FK violation
    });
  });

  describe('Admin Role Enforcement', () => {
    test('should require admin role for hard delete', async () => {
      // RED: Expect failure when client attempts hard delete
      await assumeClient(MINTED_MODE ? supabaseClientUser : client);

      const parentId = testCommentIds[0];

      // Soft-delete first (client can soft-delete their own comments)
      await assumeAdmin(MINTED_MODE ? supabaseAdmin : client);
      await (MINTED_MODE ? supabaseAdmin : client).rpc('cascade_soft_delete_comments', {
        comment_ids: [parentId]
      });

      // Now attempt hard-delete as client
      await assumeClient(MINTED_MODE ? supabaseClientUser : client);

      const { error } = await (MINTED_MODE ? supabaseClientUser : client).rpc('hard_delete_comment_tree', {
        p_comment_id: parentId,
        p_reason: 'GDPR request'
      });

      // Expect permission error
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/Admin role required/i);
    });
  });

  describe('Soft-Delete Precondition', () => {
    test('should require soft-delete precondition before hard delete', async () => {
      // RED: Expect failure when comment not soft-deleted
      await assumeAdmin(MINTED_MODE ? supabaseAdmin : client);

      const parentId = testCommentIds[0];

      // Attempt hard-delete WITHOUT soft-delete first
      const { error } = await (MINTED_MODE ? supabaseAdmin : client).rpc('hard_delete_comment_tree', {
        p_comment_id: parentId,
        p_reason: 'Test precondition enforcement'
      });

      // Expect precondition error
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/must be soft-deleted|deleted=true/i);
    });
  });

  describe('Hard-Delete Execution', () => {
    test('should hard-delete tree and log operation when all conditions met', async () => {
      // GREEN: Valid hard delete by admin on soft-deleted tree
      await assumeAdmin(MINTED_MODE ? supabaseAdmin : client);

      const parentId = testCommentIds[0];

      // Step 1: Soft-delete tree
      const { error: softDeleteError } = await (MINTED_MODE ? supabaseAdmin : client).rpc('cascade_soft_delete_comments', {
        comment_ids: [parentId]
      });
      expect(softDeleteError).toBeNull();

      // Step 2: Hard-delete tree
      const { data, error } = await (MINTED_MODE ? supabaseAdmin : client).rpc('hard_delete_comment_tree', {
        p_comment_id: parentId,
        p_reason: 'GDPR data purge request #12345'
      }) as { data: { success: boolean; descendants_deleted: number } | null; error: unknown };

      // Expect successful deletion
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.success).toBe(true);
      expect(data?.descendants_deleted).toBe(3); // Parent + 2 children

      // Verify physical deletion
      const { data: deletedComments, count } = await (MINTED_MODE ? supabaseAdmin : client)
        .from('comments')
        .select('*', { count: 'exact' })
        .in('id', testCommentIds);

      expect(count).toBe(0);
      expect(deletedComments).toHaveLength(0);

      // Verify audit log entry
      const { data: auditLog } = await (MINTED_MODE ? supabaseAdmin : client)
        .from('hard_delete_audit_log')
        .select('*')
        .eq('root_comment_id', parentId)
        .maybeSingle();

      expect(auditLog).toBeDefined();
      expect(auditLog?.operator_id).toBe(adminUserId);
      expect(auditLog?.descendant_count).toBe(3);
      expect(auditLog?.reason).toContain('GDPR');
    });
  });

  describe('Audit Trail Logging', () => {
    test('should log failed hard-delete attempts', async () => {
      // GREEN: Verify audit trail includes failures
      await assumeAdmin(MINTED_MODE ? supabaseAdmin : client);

      const parentId = testCommentIds[0];

      // Attempt hard-delete WITHOUT soft-delete (will fail)
      await (MINTED_MODE ? supabaseAdmin : client).rpc('hard_delete_comment_tree', {
        p_comment_id: parentId,
        p_reason: 'Test failure logging'
      });

      // Check audit log for failed attempt
      const { data: auditLog } = await (MINTED_MODE ? supabaseAdmin : client)
        .from('hard_delete_audit_log')
        .select('*')
        .eq('root_comment_id', parentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Expect failure logged
      expect(auditLog).toBeDefined();
      expect(auditLog?.reason).toMatch(/FAILED/i);
      expect(auditLog?.descendant_count).toBe(0); // No deletes occurred
    });
  });
});
