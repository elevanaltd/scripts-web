-- Fix comments RLS policies to match production (Phase 2.9 optimizations)
-- Issue: Consolidated migration had old policies missing admin/employee bypass
-- Solution: Drop old policies, add production-optimized policies

-- Drop old policies
DROP POLICY IF EXISTS "Users can view non-deleted comments on accessible scripts" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments on accessible scripts" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can soft delete own comments" ON public.comments;

-- Add production-optimized policies (Phase 2.9 database hardening)

-- Admin/Employee: Full access bypass (ALL operations)
CREATE POLICY "comments_admin_employee_all"
    ON public.comments
    FOR ALL
    TO authenticated
    USING (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]))
    WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'employee'::text]));

-- Client: Read optimized
CREATE POLICY "comments_client_read_optimized"
    ON public.comments
    FOR SELECT
    TO authenticated
    USING (
        (EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'client'::text
        ))
        AND (EXISTS (
            SELECT 1 FROM user_accessible_scripts uas
            WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id
        ))
    );

-- Client: Create optimized
CREATE POLICY "comments_client_create_optimized"
    ON public.comments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'client'::text
        ))
        AND (EXISTS (
            SELECT 1 FROM user_accessible_scripts uas
            WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id
        ))
        AND (user_id = auth.uid())
    );

-- Client: Update own optimized
CREATE POLICY "comments_client_update_own_optimized"
    ON public.comments
    FOR UPDATE
    TO authenticated
    USING (
        (EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'client'::text
        ))
        AND (user_id = auth.uid())
        AND (EXISTS (
            SELECT 1 FROM user_accessible_scripts uas
            WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id
        ))
    )
    WITH CHECK (
        (EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'client'::text
        ))
        AND (user_id = auth.uid())
        AND (EXISTS (
            SELECT 1 FROM user_accessible_scripts uas
            WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id
        ))
    );

-- Client: Delete own optimized
CREATE POLICY "comments_client_delete_own_optimized"
    ON public.comments
    FOR DELETE
    TO authenticated
    USING (
        (EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'client'::text
        ))
        AND (user_id = auth.uid())
        AND (EXISTS (
            SELECT 1 FROM user_accessible_scripts uas
            WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id
        ))
    );
