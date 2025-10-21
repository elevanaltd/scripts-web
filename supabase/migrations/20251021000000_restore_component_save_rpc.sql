-- EMERGENCY FIX: Restore save_script_with_components RPC function
-- Date: 2025-10-21
-- Issue: Components not saving since Oct 17 (RPC function missing/broken)
--
-- APPLY VIA: Supabase Dashboard → SQL Editor → Paste this SQL → Run
--
-- This migration restores the RPC function that allows component writes
-- by setting the transaction-scoped context variable that bypasses the write protection trigger.

CREATE OR REPLACE FUNCTION public.save_script_with_components(
    p_script_id uuid,
    p_yjs_state text,
    p_plain_text text,
    p_components jsonb
)
RETURNS SETOF public.scripts AS $$
DECLARE
    v_user_role text;
    v_script_exists boolean;
    v_has_access boolean;
BEGIN
    -- Get user role (dependency: public.get_user_role() must exist)
    v_user_role := public.get_user_role();

    -- Check if script exists
    SELECT EXISTS (
        SELECT 1 FROM public.scripts WHERE id = p_script_id
    ) INTO v_script_exists;

    -- Check access based on role
    IF v_user_role = 'admin' THEN
        v_has_access := true;
    ELSIF v_user_role = 'employee' THEN
        v_has_access := true;
    ELSIF v_user_role = 'client' THEN
        -- Clients can only view, not save
        v_has_access := false;
    ELSE
        v_has_access := false;
    END IF;

    -- Log the attempt (wrapped in BEGIN/EXCEPTION to handle missing audit_log gracefully)
    BEGIN
        INSERT INTO public.audit_log (user_id, action, target_resource, details, status)
        VALUES (
            auth.uid(),
            'save_script',
            p_script_id::text,
            jsonb_build_object(
                'role', v_user_role,
                'script_exists', v_script_exists
            ),
            CASE WHEN v_has_access THEN 'allowed' ELSE 'denied' END
        );
    EXCEPTION
        WHEN undefined_table THEN
            NULL; -- Silently skip if audit_log doesn't exist
    END;

    -- Block if no access
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Unauthorized: % users cannot save scripts', v_user_role
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- *** CRITICAL: Set transaction-scoped context variable to allow component writes ***
    -- This variable exists ONLY for the duration of this transaction and is automatically
    -- discarded at COMMIT or ROLLBACK, preventing race conditions between sessions
    SET LOCAL eav.allow_component_write = 'true';

    -- Update the script
    UPDATE public.scripts
    SET
        yjs_state = decode(p_yjs_state, 'base64'),
        plain_text = p_plain_text,
        component_count = jsonb_array_length(p_components),
        updated_at = now()
    WHERE id = p_script_id;

    -- Delete existing components
    DELETE FROM public.script_components WHERE script_id = p_script_id;

    -- Insert new components (now allowed because context variable is set)
    INSERT INTO public.script_components (script_id, component_number, content, word_count)
    SELECT
        p_script_id,
        (comp->>'component_number')::int,
        comp->>'content',
        (comp->>'word_count')::int
    FROM jsonb_array_elements(p_components) AS comp;

    -- Return the updated script
    RETURN QUERY SELECT * FROM public.scripts WHERE id = p_script_id;

    -- Context variable is automatically cleared at transaction end (COMMIT/ROLLBACK)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Update function comment
COMMENT ON FUNCTION public.save_script_with_components(uuid, text, text, jsonb) IS
'Authorized entry point for component writes. Sets transaction-scoped context variable to bypass write protection trigger. Ensures atomic save: all-or-nothing persistence for script + components. Restored 2025-10-21 to fix component save regression.';

-- Verify function was created successfully
DO $$
BEGIN
    RAISE NOTICE 'RPC function save_script_with_components restored successfully';
    RAISE NOTICE 'Component saves should now work in production';
END $$;
