CREATE OR REPLACE FUNCTION "public"."comments_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
AS $$
BEGIN
  -- Explicitly qualify realtime schema to work with empty search_path
  PERFORM realtime.broadcast_changes(
    'room:' || COALESCE(NEW.script_id, OLD.script_id)::text || ':comments',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  -- Standard IF/ELSE return for broad PG compatibility
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION "public"."comments_broadcast_trigger"() IS 'EMERGENCY FIX 2025-10-26: Corrected misuse of quoted trigger variables (NEW/OLD/TG_*) causing 42P01 in CI, and replaced COALESCE return with IF/ELSE.';
