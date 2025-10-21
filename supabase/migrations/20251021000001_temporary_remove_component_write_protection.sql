-- TEMPORARY WORKAROUND: Remove component write protection trigger
-- Date: 2025-10-21
-- WARNING: This is a TEMPORARY fix that removes data protection
--
-- USE ONLY IF: You need immediate component save functionality and can't fix RPC
-- REVERT: Re-apply 20251017081415_component_write_protection_trigger.sql when RPC is fixed
--
-- APPLY VIA: Supabase Dashboard → SQL Editor → Paste this SQL → Run

-- Drop the write protection triggers
DROP TRIGGER IF EXISTS protect_component_writes_insert ON public.script_components;
DROP TRIGGER IF EXISTS protect_component_writes_update ON public.script_components;

-- Drop the trigger function
DROP FUNCTION IF EXISTS public.block_direct_component_writes();

-- Log the change
DO $$
BEGIN
    RAISE WARNING '⚠️  Component write protection DISABLED';
    RAISE WARNING '⚠️  This is a TEMPORARY workaround';
    RAISE WARNING '⚠️  Direct writes to script_components are now allowed';
    RAISE WARNING '⚠️  RESTORE protection after fixing RPC function';
    RAISE NOTICE '';
    RAISE NOTICE 'Component saves should now work via fallback PATCH pattern';
    RAISE NOTICE 'However, you lose atomic transaction guarantees';
    RAISE NOTICE 'Re-enable protection by running: 20251017081415_component_write_protection_trigger.sql';
END $$;

-- Update table comment to reflect temporary state
COMMENT ON TABLE public.script_components IS
'Component spine table. [TEMPORARY] Write protection DISABLED on 2025-10-21 due to RPC function issue. Re-enable protection after restoring save_script_with_components() function.';
