-- Migration: Fix Comments Table Constraints
-- Purpose: Add position validation and fix threading behavior
-- Date: 2025-10-21
-- Related Tests: src/lib/comments.test.ts (Lines 433-451, 455-507)
--
-- Changes:
-- 1. Add CHECK constraint: end_position > start_position
-- 2. Change parent_comment_id foreign key: ON DELETE CASCADE → ON DELETE SET NULL

BEGIN;

-- Fix 1: Add position validation constraint
-- Test expects: Database error code '23514' when start_position >= end_position

-- First, fix existing data that violates the constraint
-- Script-level comments (0,0) should be (0,1) to be valid ranges
UPDATE public.comments
SET end_position = 1
WHERE start_position = 0 AND end_position = 0;

-- Now add the constraint (will fail if any violations remain)
ALTER TABLE public.comments
  ADD CONSTRAINT check_position_range CHECK (end_position > start_position);

-- Fix 2: Change threading behavior to preserve child comments when parent deleted
-- Current: ON DELETE CASCADE (deletes children)
-- Expected: ON DELETE SET NULL (children survive as top-level comments)

-- Drop existing foreign key constraint
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_parent_comment_id_fkey;

-- Recreate with SET NULL behavior
ALTER TABLE public.comments
  ADD CONSTRAINT comments_parent_comment_id_fkey
  FOREIGN KEY (parent_comment_id)
  REFERENCES public.comments(id)
  ON DELETE SET NULL;

COMMIT;

-- Validation:
-- Test 1: Should reject invalid position range
-- INSERT INTO comments (script_id, user_id, content, start_position, end_position)
-- VALUES ('...', '...', 'test', 20, 10); -- Should fail with '23514'
--
-- Test 2: Should preserve child when parent deleted
-- DELETE FROM comments WHERE id = parent_id;
-- Child's parent_comment_id should become NULL (not deleted)
