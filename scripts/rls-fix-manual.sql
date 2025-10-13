-- Manual RLS Fix for Comments Table
-- Copy and paste these statements one by one into Supabase SQL Editor

-- 1. Drop old client policy
DROP POLICY IF EXISTS "comments_client_read" ON public.comments;

-- 2. Create client read-only policy
CREATE POLICY "comments_client_read_only" ON public.comments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
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

-- 3. Block client INSERT operations
CREATE POLICY "comments_client_no_insert" ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
    NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
);

-- 4. Block client UPDATE operations
CREATE POLICY "comments_client_no_update" ON public.comments
FOR UPDATE
TO authenticated
USING (
    NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
)
WITH CHECK (
    NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
);

-- 5. Block client DELETE operations
CREATE POLICY "comments_client_no_delete" ON public.comments
FOR DELETE
TO authenticated
USING (
    NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'client'
    )
);

-- 6. Block unauthorized users (users without profiles)
CREATE POLICY "comments_unauthorized_no_access" ON public.comments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
    )
);

-- Verification: These should work after applying the policies
--
-- Test as admin (should succeed):
-- INSERT INTO comments (script_id, user_id, content, start_position, end_position)
-- VALUES ('0395f3f7-8eb7-4a1f-aa17-27d0d3a38680', auth.uid(), 'Admin test', 0, 10);
--
-- Test as client (should fail):
-- INSERT INTO comments (script_id, user_id, content, start_position, end_position)
-- VALUES ('0395f3f7-8eb7-4a1f-aa17-27d0d3a38680', auth.uid(), 'Client test', 0, 10);