-- ============================================================================
-- FIX: Update script status validation to include all 6 workflow statuses
-- ============================================================================
-- Date: 2025-10-11
-- Purpose: Add missing 'pend_start' and 'reuse' statuses to database validation
--
-- Problem: Database RPC function only validates 4 statuses (draft, in_review,
-- rework, approved) but TypeScript code expects 6 statuses (pend_start, draft,
-- in_review, rework, approved, reuse)
--
-- Solution: Update both the ENUM type and the RPC validation to match TypeScript
-- ============================================================================

-- Step 1: Add missing values to enum type
ALTER TYPE public.script_workflow_status ADD VALUE IF NOT EXISTS 'pend_start';
ALTER TYPE public.script_workflow_status ADD VALUE IF NOT EXISTS 'reuse';

-- Step 2: Update the RPC function with correct validation
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
    -- Validate status is allowed value (ALL 6 statuses)
    IF p_new_status NOT IN ('pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be one of: pend_start, draft, in_review, rework, approved, reuse', p_new_status;
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

-- Step 3: Update CHECK constraint on scripts table
ALTER TABLE public.scripts DROP CONSTRAINT IF EXISTS scripts_status_check;
ALTER TABLE public.scripts ADD CONSTRAINT scripts_status_check
CHECK (status IN ('pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse'));

-- Step 4: Update column comment
COMMENT ON COLUMN public.scripts.status IS 'Workflow status: pend_start, draft, in_review, rework, approved, reuse';

-- Update function documentation
COMMENT ON FUNCTION public.update_script_status(uuid, text) IS
'Securely updates the status of a script for an authorized user. Provides column-level security that RLS cannot enforce. Only updates status and updated_at columns. Valid statuses: pend_start, draft, in_review, rework, approved, reuse';
