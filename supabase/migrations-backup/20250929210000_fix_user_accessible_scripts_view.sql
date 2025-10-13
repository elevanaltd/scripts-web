-- ============================================================================
-- FIX USER ACCESSIBLE SCRIPTS VIEW - Remove Invalid Index
-- ============================================================================
-- Date: 2025-09-29
-- Purpose: Fix issue with creating index on view (not allowed)
-- Issue: Previous migration tried to create index on view, which failed
-- Solution: Create materialized view instead for indexing and performance
-- ============================================================================

-- Step 1: Drop the problematic index attempt (if it somehow was created)
DROP INDEX IF EXISTS public.idx_user_accessible_scripts_user_script;

-- Step 2: Drop policies that depend on the view FIRST
DROP POLICY IF EXISTS "comments_client_read_optimized" ON public.comments;
DROP POLICY IF EXISTS "comments_client_create_optimized" ON public.comments;
DROP POLICY IF EXISTS "comments_client_update_own_optimized" ON public.comments;
DROP POLICY IF EXISTS "comments_client_delete_own_optimized" ON public.comments;

-- Step 3: Now drop and recreate as materialized view for better performance
DROP VIEW IF EXISTS public.user_accessible_scripts;

-- Step 3: Create materialized view (can be indexed)
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

-- Client users: Can access scripts from assigned projects only
SELECT
    uc.user_id,
    s.id as script_id,
    'client' as access_type
FROM public.user_clients uc
JOIN public.projects p ON uc.client_filter = p.client_filter
JOIN public.videos v ON p.eav_code = v.eav_code
JOIN public.scripts s ON v.id = s.video_id;

-- Step 4: Now we can create the index on the materialized view
CREATE INDEX IF NOT EXISTS idx_user_accessible_scripts_user_script
ON public.user_accessible_scripts (user_id, script_id);

-- Step 5: Grant permissions to authenticated users
GRANT SELECT ON public.user_accessible_scripts TO authenticated;

-- Step 6: Update the refresh function to actually refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_user_accessible_scripts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW public.user_accessible_scripts;

    -- Log success
    RAISE NOTICE 'user_accessible_scripts materialized view refreshed successfully';
END;
$$;

-- Step 7: Create trigger function to auto-refresh on relevant changes
CREATE OR REPLACE FUNCTION public.trigger_refresh_user_accessible_scripts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh the materialized view when data changes
    PERFORM public.refresh_user_accessible_scripts();
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Step 8: Create triggers to auto-refresh on data changes
-- Note: Only creating triggers for key tables that affect access

-- Trigger on user_profiles (role changes)
DROP TRIGGER IF EXISTS trigger_user_profiles_refresh_scripts ON public.user_profiles;
CREATE TRIGGER trigger_user_profiles_refresh_scripts
    AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_user_accessible_scripts();

-- Trigger on user_clients (assignment changes)
DROP TRIGGER IF EXISTS trigger_user_clients_refresh_scripts ON public.user_clients;
CREATE TRIGGER trigger_user_clients_refresh_scripts
    AFTER INSERT OR UPDATE OR DELETE ON public.user_clients
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_user_accessible_scripts();

-- Trigger on scripts (new scripts added)
DROP TRIGGER IF EXISTS trigger_scripts_refresh_access ON public.scripts;
CREATE TRIGGER trigger_scripts_refresh_access
    AFTER INSERT OR DELETE ON public.scripts
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_user_accessible_scripts();

-- Step 9: Initial refresh to populate the materialized view
SELECT public.refresh_user_accessible_scripts();

-- Step 10: Grant execute permission on the refresh function
GRANT EXECUTE ON FUNCTION public.refresh_user_accessible_scripts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_refresh_user_accessible_scripts() TO authenticated;

-- Step 11: Recreate the RLS policies using the new materialized view
-- Client users: READ comments from accessible scripts (1 JOIN instead of 4)
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

-- Client users: CREATE comments on accessible scripts (1 JOIN instead of 4)
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

-- Client users: UPDATE their own comments on accessible scripts (1 JOIN instead of 4)
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

-- Client users: DELETE their own comments on accessible scripts (1 JOIN instead of 4)
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

-- ============================================================================
-- VERIFICATION NOTES
-- ============================================================================
-- The materialized view approach provides:
-- 1. Better performance than regular views (pre-computed results)
-- 2. Ability to create indexes for even faster lookups
-- 3. Auto-refresh on data changes via triggers
-- 4. Manual refresh capability via function call
--
-- This should resolve the PGRST205 "Object not found" errors in tests
-- ============================================================================