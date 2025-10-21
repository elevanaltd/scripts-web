-- DIAGNOSTIC: Check component save architecture in production
-- Date: 2025-10-21
-- Purpose: Identify what's missing or broken in the component save system
--
-- APPLY VIA: Supabase Dashboard → SQL Editor → Paste this SQL → Run
-- INSTRUCTIONS: Review the output to see what needs to be fixed

-- Check 1: Does the RPC function exist?
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'save_script_with_components'
          AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE '✓ RPC function save_script_with_components EXISTS';
    ELSE
        RAISE WARNING '✗ RPC function save_script_with_components MISSING - this is the problem!';
    END IF;
END $$;

-- Check 2: Does get_user_role dependency exist?
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_user_role'
          AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE '✓ Dependency function get_user_role EXISTS';
    ELSE
        RAISE WARNING '✗ Dependency function get_user_role MISSING';
    END IF;
END $$;

-- Check 3: Does the write protection trigger exist?
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'protect_component_writes_insert'
    ) THEN
        RAISE NOTICE '✓ Write protection trigger protect_component_writes_insert EXISTS (blocking direct writes)';
    ELSE
        RAISE NOTICE 'ℹ Write protection trigger protect_component_writes_insert NOT FOUND';
    END IF;
END $$;

-- Check 4: Does audit_log table exist?
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = 'audit_log'
    ) THEN
        RAISE NOTICE '✓ Table audit_log EXISTS';
    ELSE
        RAISE NOTICE 'ℹ Table audit_log MISSING (not critical - RPC handles this gracefully)';
    END IF;
END $$;

-- Check 5: Show actual function definition if it exists
DO $$
DECLARE
    func_def text;
BEGIN
    SELECT prosrc INTO func_def
    FROM pg_proc
    WHERE proname = 'save_script_with_components'
      AND pronamespace = 'public'::regnamespace;

    IF func_def IS NOT NULL THEN
        RAISE NOTICE 'Function definition preview: %', substring(func_def, 1, 200);
    END IF;
END $$;

-- Check 6: Show script_components table structure
DO $$
DECLARE
    col_info text;
BEGIN
    SELECT string_agg(column_name || ' ' || data_type, ', ')
    INTO col_info
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'script_components';

    IF col_info IS NOT NULL THEN
        RAISE NOTICE '✓ script_components table columns: %', col_info;
    ELSE
        RAISE WARNING '✗ script_components table MISSING';
    END IF;
END $$;

-- SUMMARY
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== DIAGNOSTIC SUMMARY ===';
    RAISE NOTICE 'If RPC function is MISSING: Apply 20251021000000_restore_component_save_rpc.sql';
    RAISE NOTICE 'If get_user_role is MISSING: You need the consolidated schema migration first';
    RAISE NOTICE 'If ALL checks pass: The problem is elsewhere (check client-side code)';
END $$;
