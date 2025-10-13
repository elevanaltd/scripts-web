-- ============================================================================
-- COMMENTS RLS FIX - Block Client User Inserts
-- ============================================================================
-- Date: 2025-09-29
-- Purpose: Fix RLS policies to prevent client users from creating comments
-- Issue: Client users could create comments when they should be read-only
-- Solution: Add explicit INSERT blocking policy for client users
-- ============================================================================

-- Drop and recreate the client read policy to be more explicit
DROP POLICY IF EXISTS "comments_client_read" ON public.comments;

-- Client users: read-only access to comments from their assigned projects
CREATE POLICY "comments_client_read_only" ON public.comments
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

-- Explicitly block client users from INSERT operations
CREATE POLICY "comments_client_no_insert" ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
    -- Block if user is a client
    NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
);

-- Explicitly block client users from UPDATE operations
CREATE POLICY "comments_client_no_update" ON public.comments
FOR UPDATE
TO authenticated
USING (
    -- Block if user is a client
    NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
)
WITH CHECK (
    -- Block if user is a client
    NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
);

-- Explicitly block client users from DELETE operations
CREATE POLICY "comments_client_no_delete" ON public.comments
FOR DELETE
TO authenticated
USING (
    -- Block if user is a client
    NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
);

-- Also block unauthorized users (users without profiles) from all operations
CREATE POLICY "comments_unauthorized_no_access" ON public.comments
FOR ALL
TO authenticated
USING (
    -- Block if user has no profile (unauthorized)
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
    )
)
WITH CHECK (
    -- Block if user has no profile (unauthorized)
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
    )
);

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================
-- These are comments for manual verification:
--
-- Test admin can create:
-- SELECT auth.uid(); -- Should return admin user ID
-- INSERT INTO comments (script_id, user_id, content, start_position, end_position)
-- VALUES ('0395f3f7-8eb7-4a1f-aa17-27d0d3a38680', auth.uid(), 'Admin test', 0, 10);
--
-- Test client cannot create:
-- SELECT auth.uid(); -- Should return client user ID
-- INSERT INTO comments (script_id, user_id, content, start_position, end_position)
-- VALUES ('0395f3f7-8eb7-4a1f-aa17-27d0d3a38680', auth.uid(), 'Client test', 0, 10);
-- Expected: Should fail with RLS policy violation
--
-- Test client can read:
-- SELECT * FROM comments WHERE script_id = '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680';
-- Expected: Should return comments for assigned project
-- ============================================================================