-- Migration: Add comment cleanup trigger for project completion
-- Created: 2025-10-03
-- Purpose: Automatically delete comments when project is abandoned or invoiced

-- Create trigger function for comment cleanup
CREATE OR REPLACE FUNCTION trigger_cleanup_project_comments()
RETURNS TRIGGER AS $$
BEGIN
  -- Condition 1: Project marked "Not Proceeded With"
  -- Condition 2: Final invoice sent (project complete)
  IF NEW.project_phase = 'Not Proceeded With'
     OR NEW.final_invoice_sent IS NOT NULL THEN

    -- Delete all comments for this project's scripts
    -- Use IS NOT DISTINCT FROM for NULL-safe comparison
    DELETE FROM comments
    WHERE script_id IN (
      SELECT s.id
      FROM scripts s
      JOIN videos v ON v.id = s.video_id
      WHERE v.eav_code IS NOT DISTINCT FROM NEW.eav_code
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (fires only on relevant field changes)
CREATE TRIGGER cleanup_comments_on_project_completion
AFTER UPDATE OF project_phase, final_invoice_sent ON projects
FOR EACH ROW
WHEN (
  NEW.project_phase = 'Not Proceeded With'
  OR NEW.final_invoice_sent IS NOT NULL
)
EXECUTE FUNCTION trigger_cleanup_project_comments();

-- Add comment for documentation
COMMENT ON FUNCTION trigger_cleanup_project_comments() IS
  'Automatically deletes all comments for a project when marked "Not Proceeded With" or when final invoice is sent. Comments are not needed after project completion per business requirements.';
