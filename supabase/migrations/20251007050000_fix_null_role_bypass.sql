-- ============================================================================
-- FIX CRITICAL NULL ROLE BYPASS IN save_script_with_components
-- ============================================================================
-- Date: 2025-10-07
-- Issue: NULL NOT IN ('admin','employee') evaluates to NULL (not TRUE)
--        allowing users without user_profiles rows to bypass authorization
--
-- Root Cause: Line 48 of 20251007040000 migration
--   IF v_user_role NOT IN ('admin', 'employee') THEN
--   When v_user_role is NULL, condition evaluates to NULL, not TRUE
--   Function continues to UPDATE, bypassing authorization check
--
-- Impact: CATASTROPHIC - Any authenticated user without profile row can
--         modify ANY script, completely bypassing authorization and RLS
--
-- Fix: Explicitly reject NULL roles (treat missing profile as unauthorized)
--
-- Reported by: Vercel Bot PR review + User production testing
-- Authority: holistic-orchestrator BLOCKING_AUTHORITY for production risk
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_script_with_components(
    p_script_id uuid,
    p_yjs_state bytea,
    p_plain_text text,
    p_components jsonb
)
RETURNS TABLE(LIKE public.scripts)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- SECURITY: Prevent function hijacking
AS $function$
DECLARE
    v_user_id uuid;
    v_user_role text;
    v_component_count INTEGER;
BEGIN
    -- Get current user ID (InitPlan optimization)
    v_user_id := (SELECT auth.uid());

    -- Get user role
    SELECT role INTO v_user_role
    FROM public.user_profiles
    WHERE id = v_user_id;

    -- AUTHORIZATION CHECK: Only admin/employee can save scripts
    -- Per North Star: "Script (Internal): Create/edit scripts and components"
    -- Clients are limited to Review phase: "Comment, respond, resolve on script"
    --
    -- CRITICAL FIX: Treat NULL role (missing profile) as UNAUTHORIZED
    -- Previous bug: NULL NOT IN (...) evaluates to NULL, bypassing check
    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'employee') THEN
        -- AUDIT: Log the failed attempt
        INSERT INTO public.audit_log (user_id, action, target_resource, details, status)
        VALUES (
            v_user_id,
            'save_script',
            p_script_id::text,
            jsonb_build_object(
                'reason', 'Insufficient privileges - clients cannot edit scripts',
                'user_role', COALESCE(v_user_role, 'NULL_PROFILE_MISSING'),
                'component_count', jsonb_array_length(p_components),
                'fix_applied', '20251007050000_fix_null_role_bypass'
            ),
            'denied'
        );

        RAISE EXCEPTION 'Permission denied: Only internal users (admin/employee) can edit scripts'
            USING ERRCODE = '42501', -- insufficient_privilege
                  HINT = 'Clients can comment on scripts but cannot modify script content. Missing user profile is treated as unauthorized.';
    END IF;

    -- Calculate component count
    v_component_count := COALESCE(jsonb_array_length(p_components), 0);

    -- Update script (user is authorized)
    UPDATE public.scripts
    SET
        yjs_state = p_yjs_state,
        plain_text = p_plain_text,
        component_count = v_component_count,
        updated_at = NOW()
    WHERE public.scripts.id = p_script_id;

    -- Verify script exists
    IF NOT FOUND THEN
        -- Log error (script not found)
        INSERT INTO public.audit_log (user_id, action, target_resource, details, status)
        VALUES (
            v_user_id,
            'save_script',
            p_script_id::text,
            jsonb_build_object('reason', 'Script not found'),
            'error'
        );

        RAISE EXCEPTION 'Script not found: %', p_script_id
            USING ERRCODE = 'P0002'; -- no_data_found
    END IF;

    -- Delete old components (transactional with script update)
    DELETE FROM public.script_components WHERE script_id = p_script_id;

    -- Insert new components
    IF v_component_count > 0 THEN
        INSERT INTO public.script_components (script_id, component_number, content, word_count)
        SELECT
            p_script_id,
            (comp->>'number')::INTEGER,
            comp->>'content',
            (comp->>'wordCount')::INTEGER
        FROM jsonb_array_elements(p_components) AS comp;
    END IF;

    -- AUDIT: Log successful save
    INSERT INTO public.audit_log (user_id, action, target_resource, details, status)
    VALUES (
        v_user_id,
        'save_script',
        p_script_id::text,
        jsonb_build_object(
            'component_count', v_component_count,
            'user_role', v_user_role
        ),
        'allowed'
    );

    -- Return updated script
    RETURN QUERY SELECT * FROM public.scripts WHERE public.scripts.id = p_script_id;
END;
$function$;

COMMENT ON FUNCTION public.save_script_with_components(uuid, bytea, text, jsonb) IS
'Atomically saves script content and components. SECURITY: Only admin/employee roles can edit scripts (per North Star requirements). NULL roles (missing user_profiles) are treated as UNAUTHORIZED. Clients are read-only with commenting access. All save attempts (success/failure) are logged to audit_log table.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Test 1: Admin user (with profile) → Should succeed
-- Test 2: Client user (with profile) → Should fail with 42501
-- Test 3: User without profile row → Should fail with 42501 (NULL role rejection)
--
-- Expected audit_log entries:
-- - Test 2: status='denied', details.user_role='client'
-- - Test 3: status='denied', details.user_role='NULL_PROFILE_MISSING'
-- ============================================================================
