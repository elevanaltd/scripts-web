-- ============================================================================
-- FIX CLIENT COMMENT SELECT POLICY FOR EDIT/DELETE OPERATIONS
-- ============================================================================
-- Date: 2025-10-07
-- Issue: Clients cannot edit or delete their own comments
--
-- Root Cause Analysis:
--   The current SELECT policy "comments_client_read" requires:
--   1. User role = 'client' ✓
--   2. Script exists in user_accessible_scripts view ← BLOCKS OWN COMMENTS
--
--   Problem: When client tries to edit/delete THEIR OWN comment via:
--     SELECT * FROM comments WHERE id = X AND user_id = auth.uid()
--
--   The policy blocks this because it checks script access, NOT comment ownership
--
--   Result: .maybeSingle() returns null → "Permission denied"
--
-- Fix Strategy:
--   Add additional SELECT policy for clients to access their OWN comments
--   regardless of current script access status
--
--   Rationale: If client created the comment, they should be able to:
--   - View their own comment (for edit operation)
--   - Delete their own comment (for delete operation)
--
--   This matches the DELETE policy pattern we already fixed:
--   "If you created it, you can manage it"
--
-- Authority: holistic-orchestrator BLOCKING_AUTHORITY for production UX failure
-- ============================================================================

-- Add new SELECT policy for clients to access their own comments
CREATE POLICY "comments_client_select_own" ON public.comments
FOR SELECT
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
);

COMMENT ON POLICY "comments_client_select_own" ON public.comments IS
'Allows client users to SELECT their own comments regardless of current script access. Required for edit/delete operations on comments they created. Works in conjunction with comments_client_read policy which handles reading comments on scripts they have access to.';

-- ============================================================================
-- POLICY INTERACTION
-- ============================================================================
-- After this migration, clients will have TWO SELECT policies (OR logic):
-- 1. comments_client_read: Access comments on scripts they can see (for Review phase)
-- 2. comments_client_select_own: Access their OWN comments (for edit/delete operations)
--
-- Both policies use OR logic in RLS - if EITHER passes, SELECT succeeds
-- ============================================================================

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test 1: Client creates comment on accessible script → Should see it (policy 1 OR 2)
-- Test 2: Client edits their own comment → Should work (policy 2: user_id match)
-- Test 3: Client deletes their own comment → Should work (policy 2: user_id match)
-- Test 4: Client tries to view comment on inaccessible script → Should fail (both policies fail)
-- Test 5: Client tries to edit someone else's comment → Should fail (policy 2: user_id mismatch)
--
-- Expected: Clients can now edit/delete their own comments
-- ============================================================================
