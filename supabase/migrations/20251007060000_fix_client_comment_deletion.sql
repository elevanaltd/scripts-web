-- ============================================================================
-- FIX CLIENT COMMENT DELETION FAILURE
-- ============================================================================
-- Date: 2025-10-07
-- Issue: Clients cannot delete their own comments
--
-- Root Cause Analysis:
--   Current policy "comments_client_delete_own_optimized" has 3 conditions:
--   1. User role = 'client' ✓
--   2. Comment user_id = auth.uid() ✓
--   3. Script exists in user_accessible_scripts view ← FAILURE POINT
--
--   The view dependency creates unnecessary complexity and potential failure:
--   - View might not include script (refresh timing issues)
--   - View might have NULL role issues (same as save_script bypass)
--   - Additional JOIN overhead for simple ownership check
--
-- Fix Strategy:
--   Simplify client DELETE policy - users can delete their OWN comments
--   regardless of script access (they created the comment, they can delete it)
--
--   Rationale: If client created a comment, they obviously had access at that time
--   Removing the comment doesn't modify script content (per North Star)
--   Matches user expectation: "I created it, I can delete it"
--
-- Authority: holistic-orchestrator BLOCKING_AUTHORITY for production UX failure
-- ============================================================================

-- Drop the complex policy with view dependency
DROP POLICY IF EXISTS "comments_client_delete_own_optimized" ON public.comments;

-- Create simplified client DELETE policy
-- Clients can delete their own comments (ownership-based, no view dependency)
CREATE POLICY "comments_client_delete_own_simple" ON public.comments
FOR DELETE
TO authenticated
USING (
    -- Must be a client user (with explicit NULL handling)
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = (SELECT auth.uid())
        AND user_profiles.role = 'client'
    )
    AND
    -- Must be their own comment (simple ownership check)
    comments.user_id = (SELECT auth.uid())
);

COMMENT ON POLICY "comments_client_delete_own_simple" ON public.comments IS
'Allows client users to delete their own comments. Simplified policy without view dependency - if client created the comment, they can delete it. Per North Star: Comments are client Review phase actions, distinct from script editing.';

-- ============================================================================
-- ALTERNATIVE: If NULL role is causing issues here too, use this version:
-- ============================================================================
-- DROP POLICY IF EXISTS "comments_client_delete_own_simple" ON public.comments;
--
-- CREATE POLICY "comments_client_delete_own_null_safe" ON public.comments
-- FOR DELETE
-- TO authenticated
-- USING (
--     -- Get user role with NULL safety
--     (
--         SELECT COALESCE(role, '') FROM public.user_profiles
--         WHERE user_profiles.id = (SELECT auth.uid())
--     ) = 'client'
--     AND
--     -- Must be their own comment
--     comments.user_id = (SELECT auth.uid())
-- );
-- ============================================================================

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test 1: Client creates comment → Should succeed
-- Test 2: Client deletes their own comment → Should succeed
-- Test 3: Client tries to delete another user's comment → Should fail (ownership check)
-- Test 4: Admin deletes any comment → Should succeed (admin policy)
--
-- Expected: Clients can now delete their own comments without view dependency issues
-- ============================================================================
