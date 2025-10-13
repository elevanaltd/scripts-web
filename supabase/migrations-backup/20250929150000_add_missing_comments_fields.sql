-- ============================================================================
-- ADD MISSING COMMENTS FIELDS - MINIMAL MIGRATION
-- ============================================================================
-- Date: 2025-09-29
-- Purpose: Add missing fields per ADR-003 specification
-- Fields: highlighted_text (for context) and deleted (for soft delete)
-- Note: RLS policy updates deferred to avoid complexity - existing policies will work
-- ============================================================================

-- Add highlighted_text field per ADR-003 requirement
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS highlighted_text TEXT NOT NULL DEFAULT '';

-- Add deleted field for soft delete functionality
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Add comments to clarify the decision
COMMENT ON COLUMN public.comments.highlighted_text IS 'Original selected text for context - per ADR-003 specification';
COMMENT ON COLUMN public.comments.deleted IS 'Soft delete flag - true means comment is deleted but preserved for data integrity';

-- Update existing comments to have empty highlighted_text (they were created before this field)
UPDATE public.comments
SET highlighted_text = ''
WHERE highlighted_text IS NULL;

-- Create index for soft delete filtering (comments with deleted=false are most common)
CREATE INDEX IF NOT EXISTS idx_comments_not_deleted ON public.comments(script_id, deleted)
WHERE deleted = false;