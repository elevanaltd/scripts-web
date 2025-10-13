-- ============================================================================
-- FIX CATASTROPHIC SECURITY VULNERABILITY IN save_script_with_components
-- ============================================================================
-- Date: 2025-10-07
-- Purpose: Add missing authorization check to SECURITY DEFINER function
--
-- VULNERABILITY: save_script_with_components had SECURITY DEFINER (superuser
-- privileges) but NO permission check. ANY authenticated user could modify
-- ANY script, bypassing all RLS policies.
--
-- FIX: Add role-based authorization check (admin/employee only can save scripts)
-- per North Star requirements: "Script (Internal): Create/edit scripts"
-- Clients should only READ and COMMENT, not EDIT script content.
--
-- Critical-Engineer: consulted for Security vulnerability assessment
-- Verdict: CATASTROPHIC - Complete authorization bypass
-- Recommendation: Add role check + audit logging for failed attempts
-- ============================================================================

-- Replace function with authorization check and audit logging
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
    IF v_user_role NOT IN ('admin', 'employee') THEN
        -- AUDIT: Log the failed attempt
        INSERT INTO public.audit_log (user_id, action, target_resource, details, status)
        VALUES (
            v_user_id,
            'save_script',
            p_script_id::text,
            jsonb_build_object(
                'reason', 'Insufficient privileges - clients cannot edit scripts',
                'user_role', v_user_role,
                'component_count', jsonb_array_length(p_components)
            ),
            'denied'
        );

        RAISE EXCEPTION 'Permission denied: Only internal users (admin/employee) can edit scripts'
            USING ERRCODE = '42501', -- insufficient_privilege
                  HINT = 'Clients can comment on scripts but cannot modify script content';
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
'Atomically saves script content and components. SECURITY: Only admin/employee roles can edit scripts (per North Star requirements). Clients are read-only with commenting access. All save attempts (success/failure) are logged to audit_log table.';
