-- Add updated_at trigger to scripts table
-- Issue #2: Timestamp not updating when scripts are saved
-- Pattern: Same trigger pattern as comments table (confirmed working)

-- Create trigger to automatically update updated_at on script updates
CREATE TRIGGER update_scripts_updated_at
    BEFORE UPDATE ON scripts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Verify trigger was created
COMMENT ON TRIGGER update_scripts_updated_at ON scripts IS
  'Automatically updates updated_at timestamp when script is modified. Phase 2.95B Issue #2 fix.';
