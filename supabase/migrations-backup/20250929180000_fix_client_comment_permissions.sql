-- ============================================================================
-- FIX CLIENT COMMENT PERMISSIONS - Phase 2 Requirements
-- ============================================================================
-- Date: 2025-09-29
-- Purpose: Allow client users to CREATE comments for feedback (per requirements)
-- Issue: Previous migration blocked client inserts, but they need to provide feedback
-- Solution: Allow clients to CREATE/READ comments, but not UPDATE/DELETE others' comments
-- ============================================================================

-- Drop the overly restrictive policies
DROP POLICY IF EXISTS "comments_client_no_insert" ON public.comments;
DROP POLICY IF EXISTS "comments_client_no_update" ON public.comments;
DROP POLICY IF EXISTS "comments_client_no_delete" ON public.comments;
DROP POLICY IF EXISTS "comments_client_read_only" ON public.comments;

-- Client users: Can read comments from their assigned projects
CREATE POLICY "comments_client_read" ON public.comments
FOR SELECT
TO authenticated
USING (
    -- Must be a client user
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
    AND
    -- Must have access to the project containing this script
    EXISTS (
        SELECT 1
        FROM public.scripts s
        JOIN public.videos v ON v.id = s.video_id
        JOIN public.projects p ON p.eav_code = v.eav_code
        JOIN public.user_clients uc ON uc.client_filter = p.client_filter
        WHERE s.id = comments.script_id
        AND uc.user_id = auth.uid()
    )
);

-- Client users: Can CREATE comments on their assigned projects (for feedback)
CREATE POLICY "comments_client_create" ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
    -- Must be a client user
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
    AND
    -- Must have access to the project containing this script
    EXISTS (
        SELECT 1
        FROM public.scripts s
        JOIN public.videos v ON v.id = s.video_id
        JOIN public.projects p ON p.eav_code = v.eav_code
        JOIN public.user_clients uc ON uc.client_filter = p.client_filter
        WHERE s.id = comments.script_id
        AND uc.user_id = auth.uid()
    )
    AND
    -- Must be creating comment for themselves
    comments.user_id = auth.uid()
);

-- Client users: Can only UPDATE their own comments
CREATE POLICY "comments_client_update_own" ON public.comments
FOR UPDATE
TO authenticated
USING (
    -- Must be a client user
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
    AND
    -- Must be their own comment
    comments.user_id = auth.uid()
    AND
    -- Must have access to the project
    EXISTS (
        SELECT 1
        FROM public.scripts s
        JOIN public.videos v ON v.id = s.video_id
        JOIN public.projects p ON p.eav_code = v.eav_code
        JOIN public.user_clients uc ON uc.client_filter = p.client_filter
        WHERE s.id = comments.script_id
        AND uc.user_id = auth.uid()
    )
)
WITH CHECK (
    -- Same conditions for updates
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
    AND
    comments.user_id = auth.uid()
    AND
    EXISTS (
        SELECT 1
        FROM public.scripts s
        JOIN public.videos v ON v.id = s.video_id
        JOIN public.projects p ON p.eav_code = v.eav_code
        JOIN public.user_clients uc ON uc.client_filter = p.client_filter
        WHERE s.id = comments.script_id
        AND uc.user_id = auth.uid()
    )
);

-- Client users: Can only DELETE their own comments
CREATE POLICY "comments_client_delete_own" ON public.comments
FOR DELETE
TO authenticated
USING (
    -- Must be a client user
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
    AND
    -- Must be their own comment
    comments.user_id = auth.uid()
    AND
    -- Must have access to the project
    EXISTS (
        SELECT 1
        FROM public.scripts s
        JOIN public.videos v ON v.id = s.video_id
        JOIN public.projects p ON p.eav_code = v.eav_code
        JOIN public.user_clients uc ON uc.client_filter = p.client_filter
        WHERE s.id = comments.script_id
        AND uc.user_id = auth.uid()
    )
);

-- Admin users: Full access (existing policy should cover this)
-- Drop if exists from previous migration, then recreate
DROP POLICY IF EXISTS "comments_admin_full_access" ON public.comments;
CREATE POLICY "comments_admin_full_access" ON public.comments
FOR ALL
TO authenticated
USING (
    -- Must be an admin user
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
)
WITH CHECK (
    -- Must be an admin user
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
);

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================
-- These are comments for manual verification:
--
-- Test client can create comments for feedback:
-- SELECT auth.uid(); -- Should return client user ID
-- INSERT INTO comments (script_id, user_id, content, start_position, end_position)
-- VALUES ('valid-script-id', auth.uid(), 'Client feedback comment', 0, 10);
-- Expected: Should succeed for assigned projects
--
-- Test client can read comments:
-- SELECT * FROM comments WHERE script_id = 'valid-script-id';
-- Expected: Should return comments for assigned project
--
-- Test client cannot delete others' comments:
-- DELETE FROM comments WHERE user_id != auth.uid();
-- Expected: Should fail with RLS policy violation
-- ============================================================================