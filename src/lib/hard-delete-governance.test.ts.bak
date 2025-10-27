/**
 * Governed Hard-Delete Pathway - TDD Test File (Option C Architecture)
 *
 * ⚠️ DEFERRED: Hard-Delete Infrastructure (Future Phase - Beyond B2)
 *
 * PURPOSE: Specification for future hard-delete governance pathway with:
 * - FK RESTRICT blocks accidental hard cascades (prevents data loss)
 * - Security-definer function provides GDPR/compliance pathway
 * - Soft-delete precondition enforced (must soft-delete first)
 * - All operations logged to audit table for accountability
 *
 * ARCHITECTURAL DECISION (principal-engineer approved):
 * - Status: ✅ Option C approved (6-month HIGH viability)
 * - Timeline: ⏳ DEFERRED beyond current B2 phase
 * - Current System: Soft-delete only (UPDATE deleted=true)
 * - Cleanup Strategy: Separate infrastructure phase (future)
 *
 * CURRENT IMPLEMENTATION (PRODUCTION):
 * ✅ Soft-delete exclusively via status flag (src/lib/comments.ts:542-599)
 * ✅ cascade_soft_delete_comments() RPC function (working)
 * ✅ All queries filter WHERE deleted=false
 * 🚫 NO hard-delete RPC function in production schema
 * 🚫 NO FK RESTRICT migrations applied
 * 🚫 NO audit table for hard-deletes
 *
 * WHY THESE TESTS ARE SKIPPED:
 * 1. Tests validate future architecture (not current implementation)
 * 2. Required migrations (202510211200*.sql) don't exist in codebase
 * 3. hard_delete_comment_tree() RPC function not implemented
 * 4. System uses soft-delete exclusively (architectural decision)
 * 5. Hard-delete infrastructure deferred to future phase (B3+)
 *
 * WHEN TO UNSKIP THESE TESTS:
 * 1. Create FK RESTRICT migrations (fk_comments_parent_id)
 * 2. Implement hard_delete_comment_tree() RPC function
 * 3. Create audit_comment_deletions table
 * 4. Add RLS policies for audit table
 * 5. Remove .skip from describe() block
 * 6. Run: npm test -- hard-delete-governance.test.ts
 *
 * REFERENCES:
 * - TD-006 Analysis: coordination/apps/scripts-web/analysis/TD-006-CASCADE-DELETE-PERFORMANCE-ANALYSIS.md
 * - Option C Approval: coordination/apps/scripts-web/docs/002-DOC-TD-006-FINAL-APPROVAL-PACKAGE.md
 * - Current Implementation: src/lib/comments.ts (cascade_soft_delete_comments)
 * - Project Phase: coordination/PROJECT-CONTEXT.md (B2 Multi-App Expansion)
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Test configuration - following established RLS testing pattern
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zbxvjyrbkycbfhwmmnmy.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Note: Tests explicitly skipped (describe.skip) due to deferred implementation
// Previous conditional skip (describeIfEnv) removed - see file header for details

// Test user credentials (following established pattern)
const ADMIN_EMAIL = 'test-admin@elevana.com';
const ADMIN_PASSWORD = 'test-admin-password-123';
const CLIENT_EMAIL = 'test-client@external.com';
const CLIENT_PASSWORD = 'test-client-password-123';

// Test data - dynamically created in CI environment
let TEST_SCRIPT_ID: string;

// Session cache to prevent Supabase auth rate limiting
let lastAuthTime = 0;
const MIN_AUTH_DELAY_MS = 750; // Rate limit protection

// Helper to add delay between auth operations
async function authDelay() {
  const now = Date.now();
  const timeSinceLastAuth = now - lastAuthTime;
  if (timeSinceLastAuth < MIN_AUTH_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_AUTH_DELAY_MS - timeSinceLastAuth));
  }
  lastAuthTime = Date.now();
}

// Helper function with rate limit prevention
async function signInAsUser(client: SupabaseClient, email: string, password: string) {
  await authDelay(); // Rate limit prevention

  await client.auth.signOut();
  await authDelay(); // Rate limit prevention

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  return data.user.id;
}

// Helper to ensure test script exists
async function ensureTestScriptExists(client: SupabaseClient<Database>) {
  await authDelay();

  // Sign in as admin to create test data
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });

  if (authError || !authData.user) {
    console.warn('Warning: Could not authenticate as admin for test data setup');
    TEST_SCRIPT_ID = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680'; // Fallback ID
    return;
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

// INTEGRATION TEST - DEFERRED (Future Phase Beyond B2)
// ⚠️ Tests EXPLICITLY SKIPPED: Hard-delete infrastructure not implemented (see file header)
// When implementing: Remove .skip, create migrations, implement RPC function
describe.skip('Governed Hard-Delete Pathway (Option C Architecture - DEFERRED)', () => {
  let client: SupabaseClient<Database>;
  let adminUserId: string;
  let testCommentIds: string[] = [];

  beforeEach(async () => {
    // Create client (single client pattern to avoid GoTrueClient conflicts)
    client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Ensure test script exists
    await ensureTestScriptExists(client);

    // Sign in as admin to create test data
    adminUserId = await signInAsUser(client, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Create test comment tree (parent + 2 children)
    const { data: parentComment, error: parentError } = await client
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
    const { data: childComments, error: childError } = await client
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
      await signInAsUser(client, ADMIN_EMAIL, ADMIN_PASSWORD);

      // Attempt soft-delete first
      await client.rpc('cascade_soft_delete_comments', {
        comment_ids: testCommentIds
      });

      // Attempt hard-delete (will fail gracefully if function doesn't exist yet - RED phase)
      for (const commentId of testCommentIds) {
        await client.rpc('hard_delete_comment_tree', {
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
      await signInAsUser(client, ADMIN_EMAIL, ADMIN_PASSWORD);

      const parentId = testCommentIds[0];

      // Attempt raw DELETE (should fail due to FK RESTRICT)
      const { error } = await client
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
      await signInAsUser(client, CLIENT_EMAIL, CLIENT_PASSWORD);

      const parentId = testCommentIds[0];

      // Soft-delete first (client can soft-delete their own comments)
      await signInAsUser(client, ADMIN_EMAIL, ADMIN_PASSWORD);
      await client.rpc('cascade_soft_delete_comments', {
        comment_ids: [parentId]
      });

      // Now attempt hard-delete as client
      await signInAsUser(client, CLIENT_EMAIL, CLIENT_PASSWORD);

      const { error } = await client.rpc('hard_delete_comment_tree', {
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
      await signInAsUser(client, ADMIN_EMAIL, ADMIN_PASSWORD);

      const parentId = testCommentIds[0];

      // Attempt hard-delete WITHOUT soft-delete first
      const { error } = await client.rpc('hard_delete_comment_tree', {
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
      await signInAsUser(client, ADMIN_EMAIL, ADMIN_PASSWORD);

      const parentId = testCommentIds[0];

      // Step 1: Soft-delete tree
      const { error: softDeleteError } = await client.rpc('cascade_soft_delete_comments', {
        comment_ids: [parentId]
      });
      expect(softDeleteError).toBeNull();

      // Step 2: Hard-delete tree
      const { data, error } = await client.rpc('hard_delete_comment_tree', {
        p_comment_id: parentId,
        p_reason: 'GDPR data purge request #12345'
      }) as { data: { success: boolean; descendants_deleted: number } | null; error: unknown };

      // Expect successful deletion
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.success).toBe(true);
      expect(data?.descendants_deleted).toBe(3); // Parent + 2 children

      // Verify physical deletion
      const { data: deletedComments, count } = await client
        .from('comments')
        .select('*', { count: 'exact' })
        .in('id', testCommentIds);

      expect(count).toBe(0);
      expect(deletedComments).toHaveLength(0);

      // Verify audit log entry
      const { data: auditLog } = await client
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
      await signInAsUser(client, ADMIN_EMAIL, ADMIN_PASSWORD);

      const parentId = testCommentIds[0];

      // Attempt hard-delete WITHOUT soft-delete (will fail)
      await client.rpc('hard_delete_comment_tree', {
        p_comment_id: parentId,
        p_reason: 'Test failure logging'
      });

      // Check audit log for failed attempt
      const { data: auditLog } = await client
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
