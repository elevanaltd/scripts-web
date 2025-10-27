-- Fix ambiguous column reference in acquire_script_lock
-- ERROR 42702: "column reference locked_at is ambiguous"
-- Problem: RETURNING locked_at conflicts with variable v_locked_at

CREATE OR REPLACE FUNCTION public.acquire_script_lock(p_script_id uuid)
RETURNS TABLE(success boolean, locked_by_user_id uuid, locked_by_name text, locked_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_current_user uuid := (SELECT auth.uid());
  v_display_name text;
  v_existing record;
  v_locked_at timestamptz;
BEGIN
  -- Verify access
  IF NOT EXISTS (
    SELECT 1 FROM public.user_accessible_scripts uas
    WHERE uas.script_id = p_script_id AND uas.user_id = v_current_user
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::uuid, 'No access to script'::text, NULL::timestamptz; RETURN;
  END IF;

  -- Display name
  SELECT up.display_name INTO v_display_name FROM public.user_profiles up WHERE up.id = v_current_user;

  -- If we already hold the lock, refresh and return success
  UPDATE public.script_locks
    SET last_heartbeat = NOW(), is_manual_unlock = FALSE
  WHERE script_id = p_script_id AND locked_by = v_current_user
  RETURNING script_locks.locked_at INTO v_locked_at;  -- Fully qualify column
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, v_current_user, v_display_name, v_locked_at; RETURN;
  END IF;

  -- Try to create the lock (first writer wins)
  INSERT INTO public.script_locks (script_id, locked_by, locked_at, last_heartbeat)
  VALUES (p_script_id, v_current_user, NOW(), NOW())
  ON CONFLICT DO NOTHING
  RETURNING script_locks.locked_at INTO v_locked_at;  -- Fully qualify column

  IF FOUND THEN
    -- We acquired it
    RETURN QUERY SELECT TRUE, v_current_user, v_display_name, v_locked_at; RETURN;
  END IF;

  -- Someone holds a lock: check if expired and attempt to take over atomically
  SELECT sl.locked_by, sl.locked_at, sl.last_heartbeat, up.display_name
  INTO v_existing
  FROM public.script_locks sl
  JOIN public.user_profiles up ON up.id = sl.locked_by
  WHERE sl.script_id = p_script_id
  FOR UPDATE;  -- serialize with other updaters

  IF v_existing.last_heartbeat <= NOW() - INTERVAL '30 minutes' THEN
    UPDATE public.script_locks
      SET locked_by = v_current_user,
          locked_at = NOW(),
          last_heartbeat = NOW(),
          is_manual_unlock = FALSE
    WHERE script_id = p_script_id
      AND last_heartbeat <= NOW() - INTERVAL '30 minutes'
    RETURNING script_locks.locked_at INTO v_locked_at;  -- Fully qualify column

    IF FOUND THEN
      RETURN QUERY SELECT TRUE, v_current_user, v_display_name, v_locked_at; RETURN;
    END IF;
  END IF;

  -- Lock still valid by someone else
  RETURN QUERY SELECT FALSE, v_existing.locked_by, v_existing.display_name, v_existing.locked_at; RETURN;
END;
$$;

COMMENT ON FUNCTION public.acquire_script_lock(uuid) IS 'EMERGENCY FIX 2025-10-26: Qualified all RETURNING locked_at as script_locks.locked_at to resolve 42702 ambiguity with v_locked_at variable.';
