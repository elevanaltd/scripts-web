-- Component Write Protection Trigger
-- Migration: 20251017000000
-- Purpose: Prevent direct writes to script_components table (only via save_script_with_components)
-- Architecture: Database trigger with transaction-scoped context variable
-- Validation: Critical-engineer approved (2025-10-17) - Pattern 2 (Database Trigger)
--
-- RATIONALE (from critical-engineer validation):
-- - Edge Function pattern has fatal flaws: cold starts (500ms-2s), regional latency (30-100ms),
--   connection pooling exhaustion, increased attack surface, transactional integrity issues
-- - Database trigger: simpler, faster, more reliable, leverages core RDBMS strengths
-- - Transaction-scoped context prevents race conditions between concurrent sessions
--
-- Critical-Engineer: consulted for Database write protection strategy

-- Step 1: Create trigger function to block direct component writes
CREATE OR REPLACE FUNCTION public.block_direct_component_writes()
RETURNS TRIGGER AS $$
DECLARE
    is_allowed TEXT;
BEGIN
    -- Check if write is allowed via transaction-scoped context variable
    -- The 't' flag means "missing_ok" - returns NULL instead of error if variable not set
    is_allowed := current_setting('eav.allow_component_write', 't');

    -- Block direct writes unless explicitly allowed by save_script_with_components
    IF is_allowed IS NULL OR is_allowed <> 'true' THEN
        RAISE EXCEPTION 'Direct writes to script_components table are not permitted. Use save_script_with_components() function.'
            USING ERRCODE = 'insufficient_privilege',
                  HINT = 'Call public.save_script_with_components(script_id, yjs_state, plain_text, components) to update components';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 2: Attach trigger to script_components table for INSERT and UPDATE
CREATE TRIGGER protect_component_writes_insert
    BEFORE INSERT ON public.script_components
    FOR EACH ROW
    EXECUTE FUNCTION public.block_direct_component_writes();

CREATE TRIGGER protect_component_writes_update
    BEFORE UPDATE ON public.script_components
    FOR EACH ROW
    EXECUTE FUNCTION public.block_direct_component_writes();

-- Step 3: Update save_script_with_components to set context variable
-- This allows the function to write to script_components table
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
    -- Get user role
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

    -- Log the attempt
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

    -- Block if no access
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Unauthorized: % users cannot save scripts', v_user_role
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- *** NEW: Set transaction-scoped context variable to allow component writes ***
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

-- Step 4: Add comment documenting write protection
COMMENT ON TABLE public.script_components IS 'Component spine table. Direct writes blocked by trigger - use save_script_with_components() function only. Ensures component identity stability (I1 immutable requirement) across all 7 EAV apps.';

COMMENT ON FUNCTION public.block_direct_component_writes() IS 'Write protection trigger. Blocks direct writes to script_components unless transaction-scoped context variable eav.allow_component_write = true. Prevents client-side bugs from corrupting component spine.';

COMMENT ON FUNCTION public.save_script_with_components(uuid, text, text, jsonb) IS 'Authorized entry point for component writes. Sets transaction-scoped context variable to bypass write protection trigger. Ensures atomic save: all-or-nothing persistence for script + components.';
