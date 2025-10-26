CREATE OR REPLACE FUNCTION "public"."comments_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Explicitly qualify realtime schema to work with empty search_path
  PERFORM "realtime"."broadcast_changes"(
    'room:' || COALESCE("NEW"."script_id", "OLD"."script_id")::"text" || ':comments',
    "TG_OP",
    "TG_OP",
    "TG_TABLE_NAME",
    "TG_TABLE_SCHEMA",
    "NEW",
    "OLD"
  );

  -- STANDARD COMPLIANT RETURN:
  -- The previous use of COALESCE("NEW", "OLD") is non-standard and can fail in some
  -- Postgres versions or contexts. A standard IF/ELSE block is safer and more explicit.
  IF (TG_OP = 'DELETE') THEN
      RETURN OLD;
  ELSE
      RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION "public"."comments_broadcast_trigger"() IS 'EMERGENCY FIX 2025-10-26: Replaced non-standard COALESCE return with a standard IF/ELSE block to resolve CI failures (42P01 error). This ensures trigger compatibility across PostgreSQL versions.';
