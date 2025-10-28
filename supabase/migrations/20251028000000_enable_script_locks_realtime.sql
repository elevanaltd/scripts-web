-- Enable realtime for script_locks table
-- Required for collaborative editing: Users must see real-time lock status changes
-- Fixes CI test failures in useScriptLock.test.ts (tests 5, 7-10)
--
-- Constitutional requirement: Collaborative Review (CLAUDE.md line 12-13)
-- Test requirement: Test Methodology Guardian approved realtime validation
--
-- Root cause: script_locks table created but never added to supabase_realtime publication
-- Impact: Realtime subscriptions to script_locks never fire, collaborative editing broken

-- Enable replica identity for DELETE event support
-- FULL replica identity required so DELETE events include the old row data
-- This allows realtime subscribers to know WHICH lock was deleted
ALTER TABLE public.script_locks REPLICA IDENTITY FULL;

-- Add script_locks to realtime publication
-- This enables postgres_changes subscriptions to fire for INSERT/UPDATE/DELETE
ALTER PUBLICATION supabase_realtime ADD TABLE public.script_locks;

COMMENT ON TABLE public.script_locks IS 'Smart Edit Locking with realtime enabled: Prevents concurrent edit conflicts and broadcasts lock changes to all connected clients. Lock expires after 30 minutes without heartbeat. Implements Lesson 005 pattern with SELECT FOR UPDATE NOWAIT race prevention.';
