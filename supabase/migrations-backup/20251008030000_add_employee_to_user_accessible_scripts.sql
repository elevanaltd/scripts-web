-- ============================================================================
-- ADD EMPLOYEE ROLE TO USER_ACCESSIBLE_SCRIPTS MATERIALIZED VIEW
-- ============================================================================
-- Date: 2025-10-08
-- Issue: Employee role missing from user_accessible_scripts view
--        Employees unable to save scripts or update status
--
-- Root Cause: View defined in 20250929210000 only includes admin (lines 24-31)
--             and client (lines 35-43) roles. Employee role omitted.
--
-- Impact: CRITICAL - Employee users (internal team members) cannot:
--   1. Save script edits (update_script_status checks this view)
--   2. Create new scripts (same authorization check)
--   3. Update component content (same authorization check)
--
-- User Report: "She's unable to create new scripts and components...
--              She also is unable to make any change to status"
--
-- North Star: "Script (Internal): Create/edit scripts and components"
--             Internal = admin + employee roles
--
-- Fix: Add employee role with same access pattern as admin (all scripts)
--
-- Authority: holistic-orchestrator BLOCKING_AUTHORITY for production risk
--            (Constitutional Line 151-158)
-- ============================================================================

-- Step 1: Drop policies that depend on the materialized view
DROP POLICY IF EXISTS "comments_client_read_optimized" ON public.comments;
DROP POLICY IF EXISTS "comments_client_create_optimized" ON public.comments;
DROP POLICY IF EXISTS "comments_client_update_own_optimized" ON public.comments;
DROP POLICY IF EXISTS "comments_client_delete_own_optimized" ON public.comments;

-- Step 2: Drop and recreate materialized view with employee role included
DROP MATERIALIZED VIEW IF EXISTS public.user_accessible_scripts CASCADE;

CREATE MATERIALIZED VIEW public.user_accessible_scripts AS
-- Admin users: Can access ALL scripts
SELECT
    up.id as user_id,
    s.id as script_id,
    'admin' as access_type
FROM public.user_profiles up
CROSS JOIN public.scripts s
WHERE up.role = 'admin'

UNION ALL

-- Employee users: Can access ALL scripts (same as admin per North Star)
-- North Star: "Script (Internal): Create/edit scripts and components"
-- Internal team = admin + employee roles
SELECT
    up.id as user_id,
    s.id as script_id,
    'employee' as access_type
FROM public.user_profiles up
CROSS JOIN public.scripts s
WHERE up.role = 'employee'

UNION ALL

-- Client users: Can access scripts from assigned projects only
-- North Star: "Review (Client + Internal): Comment, respond, resolve on script"
-- Clients have read-only access with commenting capability
SELECT
    uc.user_id,
    s.id as script_id,
    'client' as access_type
FROM public.user_clients uc
JOIN public.projects p ON uc.client_filter = p.client_filter
JOIN public.videos v ON p.eav_code = v.eav_code
JOIN public.scripts s ON v.id = s.video_id;

-- Step 3: Create unique index on materialized view for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accessible_scripts_user_script
ON public.user_accessible_scripts (user_id, script_id);

-- Step 4: Recreate RLS policies (unchanged from original migration)
CREATE POLICY "comments_client_read_optimized" ON public.comments
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
    -- Single JOIN to pre-computed access view
    EXISTS (
        SELECT 1 FROM public.user_accessible_scripts uas
        WHERE uas.user_id = auth.uid()
        AND uas.script_id = comments.script_id
    )
);

CREATE POLICY "comments_client_create_optimized" ON public.comments
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
    -- Single JOIN to pre-computed access view
    EXISTS (
        SELECT 1 FROM public.user_accessible_scripts uas
        WHERE uas.user_id = auth.uid()
        AND uas.script_id = comments.script_id
    )
    AND
    -- Must be creating comment for themselves
    comments.user_id = auth.uid()
);

CREATE POLICY "comments_client_update_own_optimized" ON public.comments
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
    -- Single JOIN to pre-computed access view
    EXISTS (
        SELECT 1 FROM public.user_accessible_scripts uas
        WHERE uas.user_id = auth.uid()
        AND uas.script_id = comments.script_id
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
        SELECT 1 FROM public.user_accessible_scripts uas
        WHERE uas.user_id = auth.uid()
        AND uas.script_id = comments.script_id
    )
);

CREATE POLICY "comments_client_delete_own_optimized" ON public.comments
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
    -- Single JOIN to pre-computed access view
    EXISTS (
        SELECT 1 FROM public.user_accessible_scripts uas
        WHERE uas.user_id = auth.uid()
        AND uas.script_id = comments.script_id
    )
);

-- Step 5: Refresh materialized view to populate data
REFRESH MATERIALIZED VIEW public.user_accessible_scripts;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test Cases:
--
-- 1. Admin user saves script → Should succeed (existing functionality)
-- 2. Employee user saves script → Should succeed (FIX VALIDATION)
-- 3. Employee user updates status → Should succeed (FIX VALIDATION)
-- 4. Client user attempts save → Should fail with 42501 (existing behavior)
--
-- Query to verify view contents:
-- SELECT user_id, script_id, access_type
-- FROM public.user_accessible_scripts
-- WHERE access_type = 'employee';
--
-- Expected: Rows returned for all employee users × all scripts (CROSS JOIN)
-- ============================================================================

COMMENT ON MATERIALIZED VIEW public.user_accessible_scripts IS
'Determines script access permissions for all user roles: admin (full access), employee (full access per North Star "Internal" definition), client (assigned projects only). Used by update_script_status() and RLS policies. Refreshes via triggers on user_profiles, user_clients, and scripts tables.';
