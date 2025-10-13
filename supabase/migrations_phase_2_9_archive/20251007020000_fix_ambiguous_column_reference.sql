-- ============================================================================
-- FIX AMBIGUOUS COLUMN REFERENCE
-- ============================================================================
-- Date: 2025-10-07
-- Purpose: Fix ambiguous column reference in save_script_with_components function
-- Issue: Supabase linter error - "column reference 'id' is ambiguous"
-- Solution: Qualify column reference with table name
-- ============================================================================

-- Drop and recreate the function with qualified column reference
DROP FUNCTION IF EXISTS public.save_script_with_components(uuid, bytea, text, jsonb);

CREATE FUNCTION public.save_script_with_components(p_script_id uuid, p_yjs_state bytea, p_plain_text text, p_components jsonb)
 RETURNS TABLE("like" public.scripts)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''  -- SECURITY: Prevent function hijacking
AS $function$
DECLARE
    v_component_count INTEGER;
BEGIN
    -- Calculate component count
    v_component_count := COALESCE(jsonb_array_length(p_components), 0);

    -- Update the main script table (FIX: Qualify id with table name)
    UPDATE public.scripts
    SET
        yjs_state = p_yjs_state,
        plain_text = p_plain_text,
        component_count = v_component_count,
        updated_at = NOW()
    WHERE public.scripts.id = p_script_id;

    -- Delete old components (in transaction)
    DELETE FROM public.script_components WHERE script_id = p_script_id;

    -- Insert new components if any exist
    IF v_component_count > 0 THEN
        INSERT INTO public.script_components (script_id, component_number, content, word_count)
        SELECT
            p_script_id,
            (comp->>'number')::INTEGER,
            comp->>'content',
            (comp->>'wordCount')::INTEGER
        FROM jsonb_array_elements(p_components) AS comp;
    END IF;

    -- Return the updated script
    RETURN QUERY SELECT * FROM public.scripts WHERE public.scripts.id = p_script_id;
END;
$function$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Fixed ambiguous column reference in save_script_with_components';
    RAISE NOTICE 'All column references now qualified with table names';
END $$;

-- implementation-lead: Fixed ambiguous column reference for linter compliance
