-- ============================================================================
-- FIX ADMIN RLS POLICIES - Enable UPDATE/DELETE Operations
-- ============================================================================
-- Date: 2025-09-30
-- Purpose: Ensure admin users can UPDATE and DELETE comments
-- Issue: Current "FOR ALL" policy may not be properly granting UPDATE/DELETE
-- Solution: Explicitly create separate policies for each operation
-- ============================================================================

-- Drop the existing combined admin policy
DROP POLICY IF EXISTS "comments_admin_full_access_optimized" ON public.comments;
DROP POLICY IF EXISTS "comments_admin_full_access" ON public.comments;

-- Create explicit admin policies for each operation
-- This ensures PostgreSQL RLS properly recognizes admin permissions

-- Admin SELECT policy
CREATE POLICY "comments_admin_select" ON public.comments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
);

-- Admin INSERT policy
CREATE POLICY "comments_admin_insert" ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
);

-- Admin UPDATE policy (CRITICAL FIX)
CREATE POLICY "comments_admin_update" ON public.comments
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
);

-- Admin DELETE policy (CRITICAL FIX)
CREATE POLICY "comments_admin_delete" ON public.comments
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Test as admin user:
-- 1. UPDATE public.comments SET content = 'Test update' WHERE id = '<comment-id>';
-- 2. DELETE FROM public.comments WHERE id = '<comment-id>';
--
-- Both should succeed without RLS policy violations
-- ============================================================================