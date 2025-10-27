-- Migration: Drop production_notes table
-- Reason: Table was deleted from Supabase dashboard (2025-10-24) - no longer needed
-- This migration documents the schema change for reproducibility

-- Drop the production_notes table
DROP TABLE IF EXISTS "public"."production_notes" CASCADE;

-- Note: RLS policies on production_notes are automatically dropped with CASCADE
-- No dependent objects should exist since this table was not in use
