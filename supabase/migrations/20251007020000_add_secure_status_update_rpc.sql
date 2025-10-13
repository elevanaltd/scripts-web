-- ============================================================================
-- SECURE SCRIPT STATUS UPDATE VIA RPC
-- ============================================================================
-- Date: 2025-10-07
-- Purpose: Provide column-level security for script status updates
--
-- Problem: RLS doesn't support column-level policies. Granting UPDATE on
-- scripts table allows clients to modify ANY column (yjs_state, plain_text, etc.)
--
-- Solution: Stored procedure with SECURITY DEFINER that:
--   1. Validates user access via user_accessible_scripts
--   2. Updates ONLY status and updated_at columns
--   3. Returns updated script for client confirmation
--
-- Critical-Engineer: consulted for Database security model for client-initiated updates
-- Recommendation: Stored procedure pattern (Option C) provides column-level
-- security that RLS cannot enforce. SECURITY DEFINER runs with function owner
-- permissions, bypassing RLS, but explicit permission check in function body
-- ensures only authorized users can call it.
-- ============================================================================

-- Define enum type if not exists (for parameter validation)
DO $$ BEGIN
    CREATE TYPE public.script_workflow_status AS ENUM ('draft', 'in_review', 'rework', 'approved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create secure function to update only script status
CREATE OR REPLACE FUNCTION public.update_script_status(
    p_script_id uuid,
    p_new_status text
)
RETURNS SETOF public.scripts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' -- SECURITY: Prevent function hijacking
AS $$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
    v_user_role text;
BEGIN
    -- Validate status is allowed value
    IF p_new_status NOT IN ('draft', 'in_review', 'rework', 'approved') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be one of: draft, in_review, rework, approved', p_new_status;
    END IF;

    -- Check if user has access to this script
    -- Uses user_accessible_scripts view which handles admin/employee/client permissions
    IF NOT EXISTS (
        SELECT 1 FROM public.user_accessible_scripts uas
        WHERE uas.user_id = v_user_id
        AND uas.script_id = p_script_id
    ) THEN
        RAISE EXCEPTION 'Permission denied: User does not have access to script %', p_script_id
            USING ERRCODE = '42501'; -- insufficient_privilege error code
    END IF;

    -- Perform the update on ONLY status and updated_at columns
    -- This is the core of column-level security
    UPDATE public.scripts
    SET
        status = p_new_status,
        updated_at = now()
    WHERE id = p_script_id;

    -- Verify update succeeded (script exists)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Script not found: %', p_script_id
            USING ERRCODE = 'P0002'; -- no_data_found error code
    END IF;

    -- Return the updated script row
    RETURN QUERY SELECT * FROM public.scripts WHERE id = p_script_id;
END;
$$;

-- Add function documentation
COMMENT ON FUNCTION public.update_script_status(uuid, text) IS
'Securely updates the status of a script for an authorized user. Provides column-level security that RLS cannot enforce. Only updates status and updated_at columns.';

-- Grant execute permission to all authenticated users
-- Authorization logic is inside function body (explicit permission check)
GRANT EXECUTE ON FUNCTION public.update_script_status(uuid, text) TO authenticated;
