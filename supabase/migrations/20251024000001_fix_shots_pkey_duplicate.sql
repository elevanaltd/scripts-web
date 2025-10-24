-- ============================================================================
-- DOCUMENTATION: Duplicate PRIMARY KEY Constraint Fix for shots Table
-- ============================================================================
-- Date: 2025-10-24
-- Issue: Migration 20251022083005_remote_schema.sql contained duplicate PRIMARY KEY
-- Root Cause: Line 1066 has PRIMARY KEY constraint, line 1234-1235 attempted to add again
-- Resolution: Fixed by removing duplicate ALTER TABLE from remote_schema.sql directly
-- Status: RESOLVED - This migration documents the fix for audit trail
-- ============================================================================

-- ANALYSIS:
-- The CREATE TABLE statement at line 1066 includes:
--   CONSTRAINT "shots_pkey" PRIMARY KEY ("id")
--
-- The ALTER TABLE statement at lines 1234-1235 originally attempted:
--   ADD CONSTRAINT "shots_pkey" PRIMARY KEY ("id")
--
-- This duplicate definition caused PostgreSQL error:
--   "multiple primary keys for table shots are not allowed"
--
-- RESOLUTION APPLIED:
-- Removed the duplicate ALTER TABLE statement from remote_schema.sql (lines 1234-1235)
-- Added documentation comment explaining the removal
-- PRIMARY KEY is correctly defined once in CREATE TABLE (line 1066)
--
-- This migration file serves as audit trail documentation only.
-- No database changes needed - the source migration file has been corrected.

-- Verify correct state (documentation/validation only)
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251024000001: Duplicate PRIMARY KEY fix documented';
  RAISE NOTICE 'Source issue in remote_schema.sql has been corrected';
  RAISE NOTICE 'PRIMARY KEY constraint exists only once (in CREATE TABLE at line 1066)';

  -- Verify state if shots table exists
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'shots'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.shots'::regclass
        AND contype = 'p'
        AND conname = 'shots_pkey'
    ) THEN
      RAISE NOTICE 'shots_pkey PRIMARY KEY constraint verified (correct state)';
    END IF;
  ELSE
    RAISE NOTICE 'shots table does not exist in this environment (expected for scripts-web)';
  END IF;
END $$;
