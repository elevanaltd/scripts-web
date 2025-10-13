-- ============================================================================
-- CASCADE DELETE FUNCTIONS FOR COMMENTS
-- ============================================================================
-- Provides optimized database-side cascade delete functionality
-- to maintain thread integrity when deleting parent comments
-- ============================================================================

-- Function to recursively get all descendant comment IDs
CREATE OR REPLACE FUNCTION get_comment_descendants(parent_id UUID)
RETURNS TABLE(id UUID)
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE comment_tree AS (
    -- Start with direct children of the parent
    SELECT c.id
    FROM comments c
    WHERE c.parent_comment_id = parent_id
      AND c.deleted = false

    UNION ALL

    -- Recursively find children of children
    SELECT c.id
    FROM comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE c.deleted = false
  )
  SELECT id FROM comment_tree;
$$;

-- Function to perform atomic cascade soft delete
CREATE OR REPLACE FUNCTION cascade_soft_delete_comments(comment_ids UUID[])
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  affected_count INTEGER;
  result json;
BEGIN
  -- Perform the soft delete atomically
  UPDATE comments
  SET
    deleted = true,
    updated_at = NOW()
  WHERE id = ANY(comment_ids)
    AND deleted = false;

  -- Get the count of affected rows
  GET DIAGNOSTICS affected_count = ROW_COUNT;

  -- Return result as JSON
  result := json_build_object(
    'success', true,
    'affected_count', affected_count,
    'timestamp', NOW()
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Roll back on any error
    RAISE;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_comment_descendants(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cascade_soft_delete_comments(UUID[]) TO authenticated;

-- Add comment documentation
COMMENT ON FUNCTION get_comment_descendants(UUID) IS
  'Recursively finds all descendant comment IDs for cascade delete operations';
COMMENT ON FUNCTION cascade_soft_delete_comments(UUID[]) IS
  'Atomically soft deletes multiple comments in a single transaction';