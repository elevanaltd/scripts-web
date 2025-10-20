-- Add DELETE trigger for complete write protection
-- Date: 2025-10-20
-- Purpose: Close security gap - prevent direct DELETE operations on script_components
-- Context: D1.2 gate compliance - spine service pattern requires ALL write operations
--          (INSERT/UPDATE/DELETE) to flow through save_script_with_components()
--
-- RATIONALE:
-- - Current protection: INSERT/UPDATE triggers block direct writes
-- - Security gap: Admin/employee users can bypass spine service with direct DELETE
-- - RLS policies: Allow admin/employee DELETE (FOR ALL includes DELETE operations)
-- - Spine service atomicity: Requires controlled DELETE (line 259 of consolidated migration)
-- - Audit trail: Direct deletes bypass audit_log table
--
-- CRITICAL-ENGINEER FINDING (2025-10-20):
-- - Violation: DELETE protection missing from write protection trigger set
-- - Impact: Admins/employees can delete components without audit trail or atomicity guarantees
-- - Fix: Add BEFORE DELETE trigger using same block_direct_component_writes() function
--
-- PERFORMANCE:
-- - Expected overhead: <1ms (same function as INSERT/UPDATE triggers)
-- - Validation method: EXPLAIN ANALYZE on DELETE operation with trigger

-- Step 1: Add DELETE trigger to complete the write protection triad
CREATE TRIGGER protect_component_writes_delete
    BEFORE DELETE ON public.script_components
    FOR EACH ROW
    EXECUTE FUNCTION public.block_direct_component_writes();

-- Verification comment
COMMENT ON TRIGGER protect_component_writes_delete ON public.script_components IS
'Completes write protection triad (INSERT/UPDATE/DELETE). Prevents direct deletion of components - all deletes must flow through save_script_with_components() which sets eav.allow_component_write context variable. Part of spine service architectural pattern.';
