-- ============================================================================
-- FIX GET COMMENT DESCENDANTS COLUMN NAME
-- ============================================================================
-- Date: 2025-10-07
-- Purpose: Fix column reference in get_comment_descendants function
-- Issue: Function uses parent_id but column is named parent_comment_id
-- Solution: Update function to use correct column name
-- ============================================================================

-- Update get_comment_descendants with correct column name
CREATE OR REPLACE FUNCTION public.get_comment_descendants(parent_id uuid)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path = ''  -- SECURITY: Prevent function hijacking
AS $function$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    SELECT c.id
    FROM public.comments c
    WHERE c.parent_comment_id = get_comment_descendants.parent_id

    UNION ALL

    SELECT c.id
    FROM public.comments c
    INNER JOIN descendants d ON c.parent_comment_id = d.id
  )
  SELECT descendants.id FROM descendants;
END;
$function$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Fixed column reference in get_comment_descendants function';
END $$;

-- implementation-lead: Fixed column reference from parent_id to parent_comment_id
