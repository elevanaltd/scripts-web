-- ============================================================================
-- VERIFY ALL SECURITY HARDENING
-- ============================================================================
-- Date: 2025-10-07
-- Purpose: Final verification that ALL SECURITY DEFINER functions have search_path protection
-- Placement: MUST run AFTER all hardening migrations (hence 999999 timestamp)
-- ============================================================================

-- Verify all SECURITY DEFINER functions now have search_path protection
DO $$
DECLARE
    vulnerable_count INTEGER;
    vulnerable_functions TEXT;
BEGIN
    -- Get count and list of vulnerable functions
    SELECT COUNT(*), string_agg(p.proname, ', ')
    INTO vulnerable_count, vulnerable_functions
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
        AND p.prosecdef = true
        AND (p.proconfig IS NULL OR NOT array_to_string(p.proconfig, ',') LIKE '%search_path%');

    IF vulnerable_count > 0 THEN
        RAISE EXCEPTION 'SECURITY FAILURE: % SECURITY DEFINER functions still lack search_path protection: %', vulnerable_count, vulnerable_functions;
    ELSE
        RAISE NOTICE 'SECURITY VERIFIED: All SECURITY DEFINER functions protected with search_path';
    END IF;
END $$;

-- implementation-lead: Final verification of security hardening across all migrations
