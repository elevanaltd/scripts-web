-- ============================================================================
-- ADD SCRIPT STATUS FIELD
-- ============================================================================
-- Date: 2025-10-07
-- Purpose: Add workflow status tracking to scripts table
--
-- Feature Requirements:
--   - Status values: draft, in_review, rework, approved
--   - Default: draft (all existing scripts)
--   - Changeable by any authenticated user (admin/employee/client)
--   - UI color coding in navigation sidebar
--
-- Performance: Index added for status filtering queries
-- Security: No RLS changes required (inherits existing scripts RLS)
-- ============================================================================

-- Add status column with CHECK constraint for validation
ALTER TABLE public.scripts
ADD COLUMN status text NOT NULL DEFAULT 'draft'
CHECK (status IN ('draft', 'in_review', 'rework', 'approved'));

-- Add index for status filtering performance
CREATE INDEX idx_scripts_status ON public.scripts(status);

-- Add comment for documentation
COMMENT ON COLUMN public.scripts.status IS 'Workflow status: draft, in_review, rework, approved';

-- Grant UPDATE permission on status column (inherits from existing scripts RLS)
-- No additional grants needed - existing RLS policies control access
