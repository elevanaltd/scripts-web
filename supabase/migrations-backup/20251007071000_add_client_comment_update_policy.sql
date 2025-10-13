-- ============================================================================
-- ADD CLIENT COMMENT UPDATE POLICY (MISSING PIECE)
-- ============================================================================
-- Date: 2025-10-07
-- Issue: Clients cannot edit their own comments
--
-- Root Cause Analysis:
--   RLS policies on comments table:
--   ✅ SELECT: comments_client_select_own (just added)
--   ✅ DELETE: comments_client_delete_own_simple (exists)
--   ✅ INSERT: comments_client_create (exists)
--   ❌ UPDATE: MISSING!
--
--   Without UPDATE policy, clients can:
--   - Create comments ✓
--   - View their own comments ✓ (after SELECT policy fix)
--   - Delete their own comments ✓
--   - Edit their own comments ✗ (NO UPDATE POLICY!)
--
-- Fix Strategy:
--   Add UPDATE policy matching the same pattern as DELETE:
--   - Client role check
--   - Ownership check (user_id = auth.uid())
--   - Simple, no view dependencies
--
-- Authority: holistic-orchestrator BLOCKING_AUTHORITY for production UX failure
-- ============================================================================

-- Add UPDATE policy for clients to edit their own comments
CREATE POLICY "comments_client_update_own" ON public.comments
FOR UPDATE
TO authenticated
USING (
    -- Must be a client user (with explicit NULL handling)
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = (SELECT auth.uid())
        AND user_profiles.role = 'client'
    )
    AND
    -- Must be their own comment (ownership check)
    comments.user_id = (SELECT auth.uid())
)
WITH CHECK (
    -- After update, still must be their own comment (prevent ownership transfer)
    comments.user_id = (SELECT auth.uid())
);

COMMENT ON POLICY "comments_client_update_own" ON public.comments IS
'Allows client users to UPDATE their own comments. Ownership-based policy matching DELETE pattern. USING clause checks current ownership, WITH CHECK clause prevents ownership transfer during update.';

-- ============================================================================
-- COMPLETE CLIENT COMMENT PERMISSIONS (After This Migration)
-- ============================================================================
-- Clients can now:
-- 1. CREATE comments (comments_client_create)
-- 2. SELECT their own comments (comments_client_select_own)
-- 3. SELECT comments on accessible scripts (comments_client_read)
-- 4. UPDATE their own comments (comments_client_update_own) ← THIS MIGRATION
-- 5. DELETE their own comments (comments_client_delete_own_simple)
--
-- Pattern: Ownership-based CRUD operations on comments they created
-- ============================================================================

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test 1: Client creates comment → Should succeed (INSERT policy)
-- Test 2: Client views their own comment → Should succeed (SELECT policies)
-- Test 3: Client edits their own comment → Should succeed (UPDATE policy ← NEW)
-- Test 4: Client deletes their own comment → Should succeed (DELETE policy)
-- Test 5: Client tries to edit someone else's comment → Should fail (ownership check)
--
-- Expected: Complete CRUD operations on own comments now working
-- ============================================================================
