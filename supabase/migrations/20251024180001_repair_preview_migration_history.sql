-- ============================================================================
-- MIGRATION HISTORY REPAIR for Supabase Preview Environments
-- ============================================================================
-- Context: Preview databases still have old 12-migration history
-- Production: Already cleaned (has only 20251024180000)
-- This migration: Cleans up preview DB migration tracking to match git
--
-- This is safe to run multiple times (idempotent)
-- ============================================================================

DO $$
BEGIN
  -- Only run if we detect old migrations still present
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations 
    WHERE version IN (
      '20251023120143', '20251023120633', '20251023145016',
      '20251023145742', '20251023145839', '20251024024618',
      '20251024025429', '20251024130756', '20251024130825',
      '20251024130836', '20251024130908'
    )
  ) THEN
    
    RAISE NOTICE 'Cleaning up old migration history entries...';
    
    -- Remove old migration history entries that no longer exist in git
    DELETE FROM supabase_migrations.schema_migrations
    WHERE version IN (
      '20251022083005',  -- Old remote_schema baseline
      '20251023120143',  -- add_employee_shots_access
      '20251023120633',  -- add_employee_scene_planning_state_access
      '20251023145016',  -- add_shots_definitive_fields
      '20251023145742',  -- cleanup_shots_table_v2
      '20251023145839',  -- update_dropdown_options_constraint_v2
      '20251024024618',  -- drop_production_notes_table
      '20251024025429',  -- update_shots_status_field
      '20251024130756',  -- add_script_locks
      '20251024130825',  -- add_acquire_script_lock_function
      '20251024130836',  -- add_cleanup_expired_locks_function
      '20251024130908'   -- add_lock_verification_to_save
    );
    
    RAISE NOTICE 'Migration history cleaned. Preview DB now matches git.';
    
  ELSE
    RAISE NOTICE 'Migration history already clean. No action needed.';
  END IF;
END $$;

-- Verify final state
DO $$
DECLARE
  migration_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migration_count
  FROM supabase_migrations.schema_migrations;
  
  RAISE NOTICE 'Final migration count: %', migration_count;
  RAISE NOTICE 'Expected: 2 migrations (20251024180000 + this repair migration)';
END $$;
