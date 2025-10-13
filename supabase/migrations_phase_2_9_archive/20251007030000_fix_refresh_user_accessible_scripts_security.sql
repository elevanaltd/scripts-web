-- ============================================================================
-- FIX REFRESH USER ACCESSIBLE SCRIPTS SECURITY
-- ============================================================================
-- Date: 2025-10-07
-- Purpose: Add search_path protection to refresh_user_accessible_scripts function
-- Issue: Function missing search_path protection for SECURITY DEFINER
-- Solution: Add SET search_path = '' to prevent function hijacking
-- ============================================================================

-- Update refresh_user_accessible_scripts with search_path protection
CREATE OR REPLACE FUNCTION public.refresh_user_accessible_scripts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- SECURITY: Prevent function hijacking
AS $$
BEGIN
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW public.user_accessible_scripts;

    -- Log success
    RAISE NOTICE 'user_accessible_scripts materialized view refreshed successfully';
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Added search_path protection to refresh_user_accessible_scripts';
END $$;

-- implementation-lead: Fixed SECURITY DEFINER function missing search_path protection
