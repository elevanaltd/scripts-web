


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."script_workflow_status" AS ENUM (
    'draft',
    'in_review',
    'rework',
    'approved',
    'pend_start',
    'reuse'
);


ALTER TYPE "public"."script_workflow_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."acquire_script_lock"("p_script_id" "uuid") RETURNS TABLE("success" boolean, "locked_by_user_id" "uuid", "locked_by_name" "text", "locked_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_existing_lock RECORD;
  v_current_user UUID;
  v_display_name TEXT;
BEGIN
  -- Get current user (wrapped for empty search_path)
  v_current_user := (SELECT auth.uid());

  -- Verify user has access to this script
  IF NOT EXISTS (
    SELECT 1 FROM public.user_accessible_scripts uas
    WHERE uas.script_id = p_script_id
      AND uas.user_id = v_current_user
  ) THEN
    -- Return failure (no access)
    RETURN QUERY SELECT
      FALSE::BOOLEAN,
      NULL::UUID,
      'No access to script'::TEXT,
      NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Get user display name for return value
  SELECT up.display_name INTO v_display_name
  FROM public.user_profiles up
  WHERE up.id = v_current_user;

  -- CRITICAL: Use SELECT FOR UPDATE NOWAIT to prevent race conditions
  -- Without this, concurrent acquisitions can both succeed
  -- Expected collisions: 50/hour at production scale (10 users × 100 scripts)
  BEGIN
    SELECT sl.locked_by, sl.locked_at, sl.last_heartbeat, up.display_name
    INTO v_existing_lock
    FROM public.script_locks sl
    JOIN public.user_profiles up ON up.id = sl.locked_by
    WHERE sl.script_id = p_script_id
    FOR UPDATE NOWAIT;  -- Locks row during check, fails fast if locked

  EXCEPTION WHEN lock_not_available THEN
    -- Another transaction is acquiring this lock right now
    -- Wait a tiny bit and try to read the result
    PERFORM pg_sleep(0.05); -- 50ms

    -- Read the lock that the other transaction created
    SELECT sl.locked_by, sl.locked_at, sl.last_heartbeat, up.display_name
    INTO v_existing_lock
    FROM public.script_locks sl
    JOIN public.user_profiles up ON up.id = sl.locked_by
    WHERE sl.script_id = p_script_id;
  END;

  -- Check if lock exists and is still valid
  IF FOUND THEN
    -- If same user, refresh the lock
    IF v_existing_lock.locked_by = v_current_user THEN
      -- Update heartbeat and return success
      UPDATE public.script_locks
      SET last_heartbeat = NOW(),
          is_manual_unlock = FALSE
      WHERE script_id = p_script_id;

      RETURN QUERY SELECT
        TRUE,
        v_current_user,
        v_display_name,
        v_existing_lock.locked_at;
      RETURN;
    END IF;

    -- Different user - verify lock hasn't expired (30 min timeout)
    IF v_existing_lock.last_heartbeat > NOW() - INTERVAL '30 minutes' THEN
      -- Lock still valid, return failure with lock holder info
      RETURN QUERY SELECT
        FALSE,
        v_existing_lock.locked_by,
        v_existing_lock.display_name,
        v_existing_lock.locked_at;
      RETURN;
    ELSE
      -- Expired, delete it
      DELETE FROM public.script_locks WHERE script_id = p_script_id;
    END IF;
  END IF;

  -- No valid lock exists - acquire it
  -- Use INSERT ... ON CONFLICT to handle race where lock was just created
  INSERT INTO public.script_locks (script_id, locked_by, locked_at, last_heartbeat)
  VALUES (p_script_id, v_current_user, NOW(), NOW())
  ON CONFLICT (script_id) DO UPDATE
  SET locked_by = v_current_user,
      locked_at = NOW(),
      last_heartbeat = NOW(),
      is_manual_unlock = FALSE
  WHERE script_locks.last_heartbeat <= NOW() - INTERVAL '30 minutes';  -- Only if expired

  -- Return success
  RETURN QUERY SELECT
    TRUE,
    v_current_user,
    v_display_name,
    NOW()::TIMESTAMPTZ;
END;
$$;


ALTER FUNCTION "public"."acquire_script_lock"("p_script_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."acquire_script_lock"("p_script_id" "uuid") IS 'Acquires edit lock for script. Uses SELECT FOR UPDATE NOWAIT to prevent race conditions. Automatically cleans up expired locks (30min timeout). Returns success + lock holder info. Critical fix 2025-10-24: Added search_path protection.';



CREATE OR REPLACE FUNCTION "public"."block_direct_component_writes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    is_allowed TEXT;
BEGIN
    -- Check if write is allowed via transaction-scoped context variable
    -- The 't' flag means "missing_ok" - returns NULL instead of error if variable not set
    is_allowed := current_setting('eav.allow_component_write', 't');

    -- Block direct writes unless explicitly allowed by save_script_with_components
    IF is_allowed IS NULL OR is_allowed <> 'true' THEN
        RAISE EXCEPTION 'Direct writes to script_components table are not permitted. Use save_script_with_components() function.'
            USING ERRCODE = 'insufficient_privilege',
                  HINT = 'Call public.save_script_with_components(script_id, yjs_state, plain_text, components) to update components';
    END IF;

    -- FIXED: Return OLD for DELETE operations, NEW for INSERT/UPDATE
    -- This is critical because NEW is NULL for DELETE operations
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."block_direct_component_writes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."block_direct_component_writes"() IS 'Write protection trigger for script_components. Fixed 2025-10-21: Now correctly handles DELETE operations by returning OLD instead of NEW.';



CREATE OR REPLACE FUNCTION "public"."cascade_soft_delete_comments"("comment_ids" "uuid"[]) RETURNS TABLE("deleted_count" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  delete_count INTEGER;
BEGIN
  UPDATE public.comments 
  SET 
    deleted = true,
    updated_at = NOW()
  WHERE id = ANY(comment_ids);
  
  GET DIAGNOSTICS delete_count = ROW_COUNT;
  
  RETURN QUERY SELECT delete_count;
END;
$$;


ALTER FUNCTION "public"."cascade_soft_delete_comments"("comment_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_client_access"() RETURNS TABLE("current_user_id" "uuid", "current_user_role" "text", "client_filters" "text"[], "can_see_user_clients" boolean, "can_see_projects" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_uid uuid;
BEGIN
    -- Cache auth.uid() once
    v_uid := auth.uid();

    RETURN QUERY
    SELECT
        v_uid as current_user_id,
        (SELECT role FROM public.user_profiles WHERE id = v_uid) as current_user_role,
        ARRAY(SELECT client_filter FROM public.user_clients WHERE user_id = v_uid) as client_filters,
        EXISTS(SELECT 1 FROM public.user_clients WHERE user_id = v_uid) as can_see_user_clients,
        EXISTS(
            SELECT 1 FROM public.projects p
            WHERE p.client_filter IN (
                SELECT client_filter FROM public.user_clients WHERE user_id = v_uid
            )
        ) as can_see_projects;
END;
$$;


ALTER FUNCTION "public"."check_client_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_locks"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH deleted AS (
    DELETE FROM public.script_locks
    WHERE last_heartbeat < NOW() - INTERVAL '30 minutes'
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER FROM deleted;
$$;


ALTER FUNCTION "public"."cleanup_expired_locks"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_locks"() IS 'Cleans up expired locks (30min timeout). Scheduled via pg_cron every 10 minutes. Critical fix 2025-10-24: Added search_path protection.';



CREATE OR REPLACE FUNCTION "public"."comments_broadcast_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Explicitly qualify realtime schema to work with empty search_path
  -- This prevents attackers from creating malicious "realtime" schema functions
  PERFORM "realtime"."broadcast_changes"(
    'room:' || COALESCE("NEW"."script_id", "OLD"."script_id")::"text" || ':comments',
    "TG_OP",
    "TG_OP",
    "TG_TABLE_NAME",
    "TG_TABLE_SCHEMA",
    "NEW",
    "OLD"
  );
  RETURN COALESCE("NEW", "OLD");
END;
$$;


ALTER FUNCTION "public"."comments_broadcast_trigger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."comments_broadcast_trigger"() IS 'Emergency security fix 2025-10-24: Added SET search_path TO '''' to prevent CVE-2018-1058 class schema injection attacks.

   VULNERABILITY: SECURITY DEFINER functions without search_path allow attackers to create malicious
   schemas/functions that execute with elevated privileges (postgres superuser).

   REMEDIATION: All SECURITY DEFINER functions MUST set search_path per constitutional standard.

   Security-Specialist: CRITICAL vulnerability - privilege escalation to postgres superuser possible.
   Critical-Engineer: BLOCKING before any new deployments.

   Trigger: Broadcasts comment changes to realtime subscriptions on INSERT/UPDATE/DELETE.';



CREATE OR REPLACE FUNCTION "public"."ensure_user_profile_on_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'client'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_user_profile_on_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_comment_descendants"("parent_id" "uuid") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    SELECT c.id
    FROM public.comments c
    WHERE c.parent_comment_id = get_comment_descendants.parent_id
    
    UNION ALL
    
    SELECT c.id
    FROM public.comments c
    INNER JOIN descendants d ON c.parent_comment_id = d.id
  )
  SELECT descendants.id FROM descendants;
END;
$$;


ALTER FUNCTION "public"."get_comment_descendants"("parent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_comment_descendants"("parent_id" "uuid") IS 'Recursively finds all descendant comment IDs for a given parent comment';



CREATE OR REPLACE FUNCTION "public"."get_user_accessible_comment_ids"() RETURNS TABLE("comment_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT DISTINCT c.id
    FROM comments c
    INNER JOIN user_accessible_scripts uas
        ON c.script_id = uas.script_id
    WHERE c.deleted = false
      AND uas.user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_accessible_comment_ids"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_accessible_comment_ids"() IS 'Caches user-accessible comment IDs per transaction (InitPlan pattern). Part of TD-006 optimization.';



CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  BEGIN
    INSERT INTO public.user_profiles (id, email, role, display_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
  EXCEPTION
    WHEN unique_violation THEN
      -- User already exists (shouldn't happen but be safe)
      RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hard_delete_comment_tree"("p_comment_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_operator_id uuid;
  v_operator_email text;
  v_descendant_count integer;
  v_script_id uuid;
  v_soft_deleted boolean;
BEGIN
  -- Get operator identity
  v_operator_id := auth.uid();
  
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for hard delete operations';
  END IF;
  
  SELECT email INTO v_operator_email
  FROM auth.users
  WHERE id = v_operator_id;
  
  -- Verify operator has admin role
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = v_operator_id
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin role required for hard delete operations';
  END IF;
  
  -- Verify comment exists and is soft-deleted
  SELECT deleted, script_id INTO v_soft_deleted, v_script_id
  FROM comments
  WHERE id = p_comment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment % not found', p_comment_id;
  END IF;
  
  IF v_soft_deleted IS FALSE THEN
    RAISE EXCEPTION 'Comment must be soft-deleted (deleted=true) before hard delete. Use cascade_soft_delete_comments first.';
  END IF;
  
  -- Count descendants (entire tree to be deleted)
  WITH RECURSIVE descendants AS (
    SELECT id FROM comments WHERE id = p_comment_id
    UNION
    SELECT c.id FROM comments c
    INNER JOIN descendants d ON c.parent_comment_id = d.id
  )
  SELECT COUNT(*) INTO v_descendant_count FROM descendants;
  
  -- Log operation to audit table
  INSERT INTO hard_delete_audit_log (
    operator_id,
    operator_email,
    root_comment_id,
    descendant_count,
    script_id,
    reason
  ) VALUES (
    v_operator_id,
    v_operator_email,
    p_comment_id,
    v_descendant_count,
    v_script_id,
    p_reason
  );
  
  -- Execute hard delete (children first to satisfy FK RESTRICT)
  WITH RECURSIVE descendants AS (
    SELECT id, parent_comment_id FROM comments WHERE id = p_comment_id
    UNION
    SELECT c.id, c.parent_comment_id FROM comments c
    INNER JOIN descendants d ON c.parent_comment_id = d.id
  )
  DELETE FROM comments
  WHERE id IN (
    SELECT id FROM descendants
    ORDER BY parent_comment_id NULLS LAST  -- Delete children before parents
  );
  
  -- Return operation summary
  RETURN jsonb_build_object(
    'success', true,
    'comment_id', p_comment_id,
    'descendants_deleted', v_descendant_count,
    'operator_id', v_operator_id,
    'operator_email', v_operator_email,
    'reason', COALESCE(p_reason, 'No reason provided')
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log failed attempt (only if we have operator_id - prevents NULL constraint violation)
    IF v_operator_id IS NOT NULL THEN
      INSERT INTO hard_delete_audit_log (
        operator_id,
        operator_email,
        root_comment_id,
        descendant_count,
        script_id,
        reason
      ) VALUES (
        v_operator_id,
        v_operator_email,
        p_comment_id,
        0,  -- Failure, no deletes occurred
        v_script_id,
        'FAILED: ' || SQLERRM
      );
    END IF;
    
    RAISE;
END;
$$;


ALTER FUNCTION "public"."hard_delete_comment_tree"("p_comment_id" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hard_delete_comment_tree"("p_comment_id" "uuid", "p_reason" "text") IS 'Governed hard-delete pathway for compliance (GDPR, data retention).
   Requires admin role. Enforces soft-delete precondition. Logs all operations.
   Fixed: Error logging only occurs when operator_id exists (prevents NULL constraint violation).';



CREATE OR REPLACE FUNCTION "public"."refresh_user_accessible_scripts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW public.user_accessible_scripts;

    -- Log success
    RAISE NOTICE 'user_accessible_scripts materialized view refreshed successfully';
END;
$$;


ALTER FUNCTION "public"."refresh_user_accessible_scripts"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."scripts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "text",
    "yjs_state" "bytea",
    "plain_text" "text",
    "component_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    CONSTRAINT "scripts_status_check" CHECK (("status" = ANY (ARRAY['pend_start'::"text", 'draft'::"text", 'in_review'::"text", 'rework'::"text", 'approved'::"text", 'reuse'::"text"])))
);


ALTER TABLE "public"."scripts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."scripts"."status" IS 'Workflow status: pend_start, draft, in_review, rework, approved, reuse';



CREATE OR REPLACE FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "text", "p_plain_text" "text", "p_components" "jsonb") RETURNS SETOF "public"."scripts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
    v_user_role text;
    v_script_exists boolean;
    v_has_access boolean;
    v_current_user UUID;
BEGIN
    -- Get current user
    v_current_user := auth.uid();

    -- =========================================================================
    -- CRITICAL: Verify caller holds active lock before allowing save
    -- Without this, admin force-unlock can lead to data loss
    -- Critical-Engineer finding: 2025-10-24
    -- =========================================================================
    IF NOT EXISTS (
      SELECT 1 FROM public.script_locks sl
      WHERE sl.script_id = p_script_id
        AND sl.locked_by = v_current_user
        AND sl.last_heartbeat > NOW() - INTERVAL '30 minutes'
    ) THEN
      RAISE EXCEPTION 'Cannot save: You no longer hold the edit lock for this script'
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'Another user may have acquired the lock, or your session expired. Refresh to see current lock status.';
    END IF;

    -- Get user role (existing logic preserved)
    v_user_role := public.get_user_role();

    -- Check if script exists
    SELECT EXISTS (
        SELECT 1 FROM public.scripts WHERE id = p_script_id
    ) INTO v_script_exists;

    -- Check access based on role
    IF v_user_role = 'admin' THEN
        v_has_access := true;
    ELSIF v_user_role = 'employee' THEN
        v_has_access := true;
    ELSIF v_user_role = 'client' THEN
        -- Clients can only view, not save
        v_has_access := false;
    ELSE
        v_has_access := false;
    END IF;

    -- Log the attempt
    INSERT INTO public.audit_log (user_id, action, target_resource, details, status)
    VALUES (
        v_current_user,
        'save_script',
        p_script_id::text,
        jsonb_build_object(
            'role', v_user_role,
            'script_exists', v_script_exists,
            'lock_verified', true
        ),
        CASE WHEN v_has_access THEN 'allowed' ELSE 'denied' END
    );

    -- Block if no access
    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Unauthorized: % users cannot save scripts', v_user_role
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Set transaction-scoped context variable to allow component writes
    SET LOCAL eav.allow_component_write = 'true';

    -- Update the script
    UPDATE public.scripts
    SET
        yjs_state = decode(p_yjs_state, 'base64'),
        plain_text = p_plain_text,
        component_count = jsonb_array_length(p_components),
        updated_at = now()
    WHERE id = p_script_id;

    -- Delete existing components
    DELETE FROM public.script_components WHERE script_id = p_script_id;

    -- Insert new components
    INSERT INTO public.script_components (script_id, component_number, content, word_count)
    SELECT
        p_script_id,
        (comp->>'number')::int,
        comp->>'content',
        (comp->>'wordCount')::int
    FROM jsonb_array_elements(p_components) AS comp;

    -- Update lock heartbeat on successful save
    UPDATE public.script_locks
    SET last_heartbeat = NOW()
    WHERE script_id = p_script_id
      AND locked_by = v_current_user;

    -- Return the updated script
    RETURN QUERY SELECT * FROM public.scripts WHERE id = p_script_id;

    -- Context variable is automatically cleared at transaction end
END;
$$;


ALTER FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "text", "p_plain_text" "text", "p_components" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "text", "p_plain_text" "text", "p_components" "jsonb") IS 'Authorized entry point for script saves. CRITICAL FIX 2025-10-25: Added lock verification to prevent data loss from concurrent edits. Verifies caller holds active lock before allowing save.';



CREATE OR REPLACE FUNCTION "public"."trigger_cleanup_project_comments"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    -- HARD DELETE comments when project is abandoned or invoiced
    -- These comments have no business value after project completion
    DELETE FROM public.comments
    WHERE script_id IN (
        SELECT s.id 
        FROM public.scripts s
        JOIN public.videos v ON s.video_id = v.id
        WHERE v.eav_code = OLD.eav_code
    );
    
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trigger_cleanup_project_comments"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_cleanup_project_comments"() IS 'Hard deletes all comments for a project when marked "Not Proceeded With" or when final invoice is sent. Uses hard DELETE (not soft) because abandoned project comments have no business value and should not accumulate. User-initiated deletes remain soft delete via cascade_soft_delete_comments function.';



CREATE OR REPLACE FUNCTION "public"."update_script_status"("p_script_id" "uuid", "p_new_status" "text") RETURNS SETOF "public"."scripts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id uuid := (SELECT auth.uid());
    v_user_role text;
BEGIN
    -- Validate status is allowed value (ALL 6 statuses)
    IF p_new_status NOT IN ('pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse') THEN
        RAISE EXCEPTION 'Invalid status: %. Must be one of: pend_start, draft, in_review, rework, approved, reuse', p_new_status;
    END IF;

    -- Check if user has access to this script
    IF NOT EXISTS (
        SELECT 1 FROM public.user_accessible_scripts uas
        WHERE uas.user_id = v_user_id
        AND uas.script_id = p_script_id
    ) THEN
        RAISE EXCEPTION 'Permission denied: User does not have access to script %', p_script_id
            USING ERRCODE = '42501';
    END IF;

    -- Perform the update on ONLY status and updated_at columns
    UPDATE public.scripts
    SET
        status = p_new_status,
        updated_at = now()
    WHERE id = p_script_id;

    -- Verify update succeeded (script exists)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Script not found: %', p_script_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Return the updated script row
    RETURN QUERY SELECT * FROM public.scripts WHERE id = p_script_id;
END;
$$;


ALTER FUNCTION "public"."update_script_status"("p_script_id" "uuid", "p_new_status" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_script_status"("p_script_id" "uuid", "p_new_status" "text") IS 'Securely updates the status of a script for an authorized user. Provides column-level security that RLS cannot enforce. Only updates status and updated_at columns. Valid statuses: pend_start, draft, in_review, rework, approved, reuse';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "eav_code" "text" NOT NULL,
    "client_filter" "text",
    "project_phase" "text",
    "final_invoice_sent" timestamp with time zone,
    CONSTRAINT "projects_eav_code_check" CHECK ((("length"("eav_code") <= 6) AND ("eav_code" ~ '^EAV[0-9]{1,3}$'::"text")))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."eav_code" IS 'EAV code from Project';



CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "target_resource" "text",
    "details" "jsonb",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audit_log_status_check" CHECK (("status" = ANY (ARRAY['allowed'::"text", 'denied'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."audit_log" IS 'Security audit trail for tracking privileged operations and authorization failures.
Records user_id, action type, target resource, status (allowed/denied/error), and timestamp.';



COMMENT ON COLUMN "public"."audit_log"."user_id" IS 'User who attempted the action (NULL if user deleted)';



COMMENT ON COLUMN "public"."audit_log"."action" IS 'Action attempted (e.g., save_script, update_status, delete_comment)';



COMMENT ON COLUMN "public"."audit_log"."target_resource" IS 'Resource identifier (e.g., script_id, comment_id)';



COMMENT ON COLUMN "public"."audit_log"."details" IS 'Additional context (role, reason, error message, etc.)';



COMMENT ON COLUMN "public"."audit_log"."status" IS 'Outcome: allowed (success), denied (authorization failure), error (system failure)';



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "script_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "start_position" integer NOT NULL,
    "end_position" integer NOT NULL,
    "content" "text" NOT NULL,
    "parent_comment_id" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "highlighted_text" "text" DEFAULT ''::"text" NOT NULL,
    "deleted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "check_position_range" CHECK (("end_position" > "start_position")),
    CONSTRAINT "comments_content_check" CHECK (("length"("content") > 0)),
    CONSTRAINT "comments_start_position_check" CHECK (("start_position" >= 0))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."comments"."highlighted_text" IS 'Original selected text for context - per ADR-003 specification';



COMMENT ON COLUMN "public"."comments"."deleted" IS 'Soft delete flag - true means comment is deleted but preserved for data integrity';



CREATE TABLE IF NOT EXISTS "public"."dropdown_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "field_name" "text" NOT NULL,
    "option_value" "text" NOT NULL,
    "option_label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "dropdown_options_field_name_check" CHECK (("field_name" = ANY (ARRAY['shot_type'::"text", 'location_start_point'::"text", 'tracking_type'::"text", 'subject'::"text"])))
);


ALTER TABLE "public"."dropdown_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hard_delete_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "operator_email" "text",
    "root_comment_id" "uuid" NOT NULL,
    "descendant_count" integer NOT NULL,
    "script_id" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hard_delete_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scene_planning_state" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "script_component_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scene_planning_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."script_components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "script_id" "uuid",
    "component_number" integer NOT NULL,
    "content" "text" NOT NULL,
    "word_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."script_components" OWNER TO "postgres";


COMMENT ON TABLE "public"."script_components" IS 'Component spine table. Direct writes blocked by trigger - use save_script_with_components() function only. Ensures component identity stability (I1 immutable requirement) across all 7 EAV apps.';



CREATE TABLE IF NOT EXISTS "public"."script_locks" (
    "script_id" "uuid" NOT NULL,
    "locked_by" "uuid" NOT NULL,
    "locked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_heartbeat" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_manual_unlock" boolean DEFAULT false
);


ALTER TABLE "public"."script_locks" OWNER TO "postgres";


COMMENT ON TABLE "public"."script_locks" IS 'Smart Edit Locking: Prevents concurrent edit conflicts. Lock expires after 30 minutes without heartbeat. Implements Lesson 005 pattern with SELECT FOR UPDATE NOWAIT race prevention.';



CREATE TABLE IF NOT EXISTS "public"."videos" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "main_stream_status" "text",
    "vo_stream_status" "text",
    "production_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "eav_code" "text"
);


ALTER TABLE "public"."videos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."scripts_with_eav" WITH ("security_invoker"='on') AS
 SELECT "s"."id",
    "s"."video_id",
    "s"."yjs_state",
    "s"."plain_text",
    "s"."component_count",
    "s"."created_at",
    "s"."updated_at",
    "s"."status",
    "v"."eav_code",
    "v"."title" AS "video_title",
    "v"."production_type",
    "v"."main_stream_status",
    "v"."vo_stream_status"
   FROM ("public"."scripts" "s"
     LEFT JOIN "public"."videos" "v" ON (("s"."video_id" = "v"."id")));


ALTER VIEW "public"."scripts_with_eav" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scene_id" "uuid" NOT NULL,
    "shot_number" integer NOT NULL,
    "subject" "text",
    "action" "text",
    "shot_type" "text",
    "variant" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "location_start_point" "text",
    "location_other" "text",
    "subject_other" "text",
    "owner_user_id" "uuid",
    "tracking_type" "text",
    "shot_status" "text" DEFAULT 'no_work'::"text",
    CONSTRAINT "shots_status_check" CHECK (("shot_status" = ANY (ARRAY['no_work'::"text", '1st_take'::"text", '2nd_take'::"text"])))
);


ALTER TABLE "public"."shots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shots"."subject" IS 'Dropdown from dropdown_options with "Other" option. If "Other", fill subject_other.';



COMMENT ON COLUMN "public"."shots"."action" IS 'Free text: demo, actor movement, etc';



COMMENT ON COLUMN "public"."shots"."shot_type" IS 'Dropdown from dropdown_options: WS, MID, CU, FP, OBJ-L, OBJ-R, UNDER (fixed list, no other)';



COMMENT ON COLUMN "public"."shots"."variant" IS 'Free text: front door, internal door, siemens, bosch, etc';



COMMENT ON COLUMN "public"."shots"."location_start_point" IS 'Dropdown from dropdown_options with "Other" option. If "Other", fill location_other.';



COMMENT ON COLUMN "public"."shots"."location_other" IS 'Free text when location_start_point = "Other"';



COMMENT ON COLUMN "public"."shots"."subject_other" IS 'Free text when subject = "Other"';



COMMENT ON COLUMN "public"."shots"."owner_user_id" IS 'Owner user ID from auth.users. Not shown in scenes app UI.';



COMMENT ON COLUMN "public"."shots"."tracking_type" IS 'Dropdown from dropdown_options: Tracking, Establishing, Standard, Photos (fixed list, no other)';



CREATE TABLE IF NOT EXISTS "public"."user_clients" (
    "user_id" "uuid" NOT NULL,
    "client_filter" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "granted_by" "uuid"
);


ALTER TABLE "public"."user_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "role" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'client'::"text", 'employee'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_accessible_scripts" WITH ("security_invoker"='on') AS
 SELECT "up"."id" AS "user_id",
    "s"."id" AS "script_id",
    'admin'::"text" AS "access_type"
   FROM ("public"."user_profiles" "up"
     CROSS JOIN "public"."scripts" "s")
  WHERE ("up"."role" = 'admin'::"text")
UNION ALL
 SELECT "up"."id" AS "user_id",
    "s"."id" AS "script_id",
    'employee'::"text" AS "access_type"
   FROM ("public"."user_profiles" "up"
     CROSS JOIN "public"."scripts" "s")
  WHERE ("up"."role" = 'employee'::"text")
UNION ALL
 SELECT "uc"."user_id",
    "s"."id" AS "script_id",
    'client'::"text" AS "access_type"
   FROM ((("public"."user_clients" "uc"
     JOIN "public"."projects" "p" ON (("uc"."client_filter" = "p"."client_filter")))
     JOIN "public"."videos" "v" ON (("p"."eav_code" = "v"."eav_code")))
     JOIN "public"."scripts" "s" ON (("v"."id" = "s"."video_id")));


ALTER VIEW "public"."user_accessible_scripts" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_accessible_scripts" IS 'Determines script access permissions for all user roles: admin (full access), employee (full access per North Star "Internal" definition), client (assigned projects only). Used by update_script_status() and RLS policies.';



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dropdown_options"
    ADD CONSTRAINT "dropdown_options_field_name_option_value_key" UNIQUE ("field_name", "option_value");



ALTER TABLE ONLY "public"."dropdown_options"
    ADD CONSTRAINT "dropdown_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hard_delete_audit_log"
    ADD CONSTRAINT "hard_delete_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_eav_code_key" UNIQUE ("eav_code");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scene_planning_state"
    ADD CONSTRAINT "scene_planning_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scene_planning_state"
    ADD CONSTRAINT "scene_planning_state_script_component_id_key" UNIQUE ("script_component_id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_script_id_component_number_key" UNIQUE ("script_id", "component_number");



ALTER TABLE ONLY "public"."script_locks"
    ADD CONSTRAINT "script_locks_pkey" PRIMARY KEY ("script_id");



ALTER TABLE ONLY "public"."scripts"
    ADD CONSTRAINT "scripts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scripts"
    ADD CONSTRAINT "scripts_video_id_unique" UNIQUE ("video_id");



ALTER TABLE ONLY "public"."shots"
    ADD CONSTRAINT "shots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shots"
    ADD CONSTRAINT "shots_scene_id_shot_number_key" UNIQUE ("scene_id", "shot_number");



ALTER TABLE ONLY "public"."user_clients"
    ADD CONSTRAINT "user_clients_pkey" PRIMARY KEY ("user_id", "client_filter");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_log_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_status" ON "public"."audit_log" USING "btree" ("status");



CREATE INDEX "idx_audit_log_user_id" ON "public"."audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_comments_not_deleted" ON "public"."comments" USING "btree" ("script_id", "deleted") WHERE ("deleted" = false);



CREATE INDEX "idx_comments_parent_deleted_id" ON "public"."comments" USING "btree" ("parent_comment_id", "deleted", "id") WHERE ("deleted" = false);



CREATE INDEX "idx_comments_position" ON "public"."comments" USING "btree" ("script_id", "start_position");



CREATE INDEX "idx_comments_resolved" ON "public"."comments" USING "btree" ("script_id", "resolved_at") WHERE ("resolved_at" IS NOT NULL);



CREATE INDEX "idx_comments_script_id" ON "public"."comments" USING "btree" ("script_id");



CREATE INDEX "idx_comments_thread" ON "public"."comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_comments_unresolved" ON "public"."comments" USING "btree" ("script_id") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_dropdown_options_field_name" ON "public"."dropdown_options" USING "btree" ("field_name", "sort_order");



CREATE INDEX "idx_hard_delete_audit_log_deleted_at" ON "public"."hard_delete_audit_log" USING "btree" ("deleted_at" DESC);



CREATE INDEX "idx_hard_delete_audit_log_operator" ON "public"."hard_delete_audit_log" USING "btree" ("operator_id");



CREATE INDEX "idx_projects_client_filter" ON "public"."projects" USING "btree" ("client_filter");



CREATE INDEX "idx_scene_planning_state_script_component_id" ON "public"."scene_planning_state" USING "btree" ("script_component_id");



CREATE INDEX "idx_script_locks_last_heartbeat" ON "public"."script_locks" USING "btree" ("last_heartbeat");



CREATE INDEX "idx_script_locks_locked_by" ON "public"."script_locks" USING "btree" ("locked_by");



CREATE INDEX "idx_scripts_status" ON "public"."scripts" USING "btree" ("status");



CREATE INDEX "idx_scripts_video_id" ON "public"."scripts" USING "btree" ("video_id");



CREATE INDEX "idx_shots_scene_id" ON "public"."shots" USING "btree" ("scene_id");



CREATE INDEX "idx_shots_updated_at" ON "public"."shots" USING "btree" ("updated_at");



CREATE INDEX "idx_user_clients_filter" ON "public"."user_clients" USING "btree" ("client_filter");



CREATE INDEX "idx_user_clients_user_id" ON "public"."user_clients" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_id_role" ON "public"."user_profiles" USING "btree" ("id", "role");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



CREATE INDEX "idx_videos_eav_code" ON "public"."videos" USING "btree" ("eav_code");



CREATE INDEX "shots_owner_user_id_idx" ON "public"."shots" USING "btree" ("owner_user_id");



CREATE OR REPLACE TRIGGER "cleanup_comments_on_project_completion" AFTER UPDATE OF "project_phase", "final_invoice_sent" ON "public"."projects" FOR EACH ROW WHEN ((("new"."project_phase" = 'Not Proceeded With'::"text") OR ("new"."final_invoice_sent" IS NOT NULL))) EXECUTE FUNCTION "public"."trigger_cleanup_project_comments"();



CREATE OR REPLACE TRIGGER "comments_broadcast_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."comments_broadcast_trigger"();



CREATE OR REPLACE TRIGGER "protect_component_writes_delete" BEFORE DELETE ON "public"."script_components" FOR EACH ROW EXECUTE FUNCTION "public"."block_direct_component_writes"();



COMMENT ON TRIGGER "protect_component_writes_delete" ON "public"."script_components" IS 'Completes write protection triad (INSERT/UPDATE/DELETE). Prevents direct deletion of components - all deletes must flow through save_script_with_components() which sets eav.allow_component_write context variable. Part of spine service architectural pattern.';



CREATE OR REPLACE TRIGGER "protect_component_writes_insert" BEFORE INSERT ON "public"."script_components" FOR EACH ROW EXECUTE FUNCTION "public"."block_direct_component_writes"();



CREATE OR REPLACE TRIGGER "protect_component_writes_update" BEFORE UPDATE ON "public"."script_components" FOR EACH ROW EXECUTE FUNCTION "public"."block_direct_component_writes"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_scripts_updated_at" BEFORE UPDATE ON "public"."scripts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



COMMENT ON CONSTRAINT "comments_parent_comment_id_fkey" ON "public"."comments" IS 'CASCADE DELETE: When parent comment is deleted, all child comments are also deleted. Business requirement confirmed 2025-10-21 per user authorization.';



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hard_delete_audit_log"
    ADD CONSTRAINT "hard_delete_audit_log_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."scene_planning_state"
    ADD CONSTRAINT "scene_planning_state_script_component_id_fkey" FOREIGN KEY ("script_component_id") REFERENCES "public"."script_components"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."script_locks"
    ADD CONSTRAINT "script_locks_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."script_locks"
    ADD CONSTRAINT "script_locks_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scripts"
    ADD CONSTRAINT "scripts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shots"
    ADD CONSTRAINT "shots_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shots"
    ADD CONSTRAINT "shots_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "public"."scene_planning_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_clients"
    ADD CONSTRAINT "user_clients_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_clients"
    ADD CONSTRAINT "user_clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_eav_code_fkey" FOREIGN KEY ("eav_code") REFERENCES "public"."projects"("eav_code") ON UPDATE CASCADE ON DELETE SET NULL;



CREATE POLICY "Lock holder can update heartbeat" ON "public"."script_locks" FOR UPDATE USING (("auth"."uid"() = "locked_by"));



CREATE POLICY "Lock holder or admin can release" ON "public"."script_locks" FOR DELETE USING ((("auth"."uid"() = "locked_by") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."id" = "auth"."uid"()) AND ("up"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can acquire available locks" ON "public"."script_locks" FOR INSERT WITH CHECK ((("auth"."uid"() = "locked_by") AND (EXISTS ( SELECT 1
   FROM "public"."user_accessible_scripts" "uas"
  WHERE (("uas"."script_id" = "script_locks"."script_id") AND ("uas"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view all locks" ON "public"."script_locks" FOR SELECT USING (true);



CREATE POLICY "admin_all_dropdown_options" ON "public"."dropdown_options" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_scene_planning_state" ON "public"."scene_planning_state" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_shots" ON "public"."shots" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_read_audit_log" ON "public"."hard_delete_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"text")))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_admin_read" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."role" = 'admin'::"text")))));



CREATE POLICY "client_select_dropdown_options" ON "public"."dropdown_options" FOR SELECT USING (true);



CREATE POLICY "client_select_scene_planning_state" ON "public"."scene_planning_state" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."script_components" "sc"
     JOIN "public"."scripts" "s" ON (("sc"."script_id" = "s"."id")))
     JOIN "public"."videos" "v" ON (("s"."video_id" = "v"."id")))
  WHERE (("sc"."id" = "scene_planning_state"."script_component_id") AND ("v"."eav_code" IN ( SELECT DISTINCT "user_clients"."client_filter"
           FROM "public"."user_clients"
          WHERE ("user_clients"."user_id" = "auth"."uid"())))))));



CREATE POLICY "client_select_shots" ON "public"."shots" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((("public"."scene_planning_state" "sp"
     JOIN "public"."script_components" "sc" ON (("sp"."script_component_id" = "sc"."id")))
     JOIN "public"."scripts" "s" ON (("sc"."script_id" = "s"."id")))
     JOIN "public"."videos" "v" ON (("s"."video_id" = "v"."id")))
  WHERE (("sp"."id" = "shots"."scene_id") AND ("v"."eav_code" IN ( SELECT DISTINCT "user_clients"."client_filter"
           FROM "public"."user_clients"
          WHERE ("user_clients"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_admin_employee_all" ON "public"."comments" TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "comments_client_create_optimized_v2" ON "public"."comments" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ("public"."get_user_role"() = 'client'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_accessible_scripts" "uas"
  WHERE (("uas"."user_id" = "auth"."uid"()) AND ("uas"."script_id" = "comments"."script_id"))))));



CREATE POLICY "comments_client_delete_own_optimized_v2" ON "public"."comments" FOR DELETE USING ((("user_id" = "auth"."uid"()) AND (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])) OR ("id" IN ( SELECT "get_user_accessible_comment_ids"."comment_id"
   FROM "public"."get_user_accessible_comment_ids"() "get_user_accessible_comment_ids"("comment_id"))))));



CREATE POLICY "comments_client_update_own_optimized_v2" ON "public"."comments" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])) OR ("id" IN ( SELECT "get_user_accessible_comment_ids"."comment_id"
   FROM "public"."get_user_accessible_comment_ids"() "get_user_accessible_comment_ids"("comment_id")))))) WITH CHECK ((("user_id" = "auth"."uid"()) AND (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])) OR ("id" IN ( SELECT "get_user_accessible_comment_ids"."comment_id"
   FROM "public"."get_user_accessible_comment_ids"() "get_user_accessible_comment_ids"("comment_id"))))));



CREATE POLICY "components_modify_admin_employee" ON "public"."script_components" TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "components_select_unified" ON "public"."script_components" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])) OR (EXISTS ( SELECT 1
   FROM (("public"."scripts" "s"
     JOIN "public"."videos" "v" ON (("s"."video_id" = "v"."id")))
     JOIN "public"."projects" "p" ON (("v"."eav_code" = "p"."eav_code")))
  WHERE (("s"."id" = "script_components"."script_id") AND ("p"."client_filter" IN ( SELECT "user_clients"."client_filter"
           FROM "public"."user_clients"
          WHERE ("user_clients"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))))));



ALTER TABLE "public"."dropdown_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_all_scene_planning_state" ON "public"."scene_planning_state" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'employee'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'employee'::"text")))));



COMMENT ON POLICY "employee_all_scene_planning_state" ON "public"."scene_planning_state" IS 'Employees have full access to scene_planning_state for scene planning workflow';



CREATE POLICY "employee_all_shots" ON "public"."shots" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'employee'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'employee'::"text")))));



COMMENT ON POLICY "employee_all_shots" ON "public"."shots" IS 'Employees have full access to shots for scene planning workflow';



ALTER TABLE "public"."hard_delete_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_read_all" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "profiles_read_own" ON "public"."user_profiles" FOR SELECT USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "profiles_update_own" ON "public"."user_profiles" FOR UPDATE USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_modify_admin_employee" ON "public"."projects" TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "projects_select_unified" ON "public"."projects" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])) OR ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."role" = 'client'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."user_clients"
  WHERE (("user_clients"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_clients"."client_filter" = "projects"."client_filter")))))));



CREATE POLICY "realtime_select_simple" ON "public"."comments" FOR SELECT USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])) OR ("id" IN ( SELECT "get_user_accessible_comment_ids"."comment_id"
   FROM "public"."get_user_accessible_comment_ids"() "get_user_accessible_comment_ids"("comment_id")))));



CREATE POLICY "realtime_select_simple" ON "public"."scripts" FOR SELECT TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."scene_planning_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."script_components" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."script_locks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scripts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scripts_modify_admin_employee" ON "public"."scripts" TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



ALTER TABLE "public"."shots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_clients_modify_admin" ON "public"."user_clients" TO "authenticated" USING (("public"."get_user_role"() = 'admin'::"text")) WITH CHECK (("public"."get_user_role"() = 'admin'::"text"));



CREATE POLICY "user_clients_select_unified" ON "public"."user_clients" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."get_user_role"() = 'admin'::"text")));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "videos_modify_admin_employee" ON "public"."videos" TO "authenticated" USING (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"]))) WITH CHECK (("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])));



CREATE POLICY "videos_select_unified" ON "public"."videos" FOR SELECT TO "authenticated" USING ((("public"."get_user_role"() = ANY (ARRAY['admin'::"text", 'employee'::"text"])) OR ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_profiles"."role" = 'client'::"text")))) AND (EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."user_clients" "uc" ON (("uc"."client_filter" = "p"."client_filter")))
  WHERE (("p"."eav_code" = "videos"."eav_code") AND ("uc"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."acquire_script_lock"("p_script_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."acquire_script_lock"("p_script_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."acquire_script_lock"("p_script_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."block_direct_component_writes"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_direct_component_writes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_direct_component_writes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cascade_soft_delete_comments"("comment_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cascade_soft_delete_comments"("comment_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cascade_soft_delete_comments"("comment_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_client_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_client_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_client_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_locks"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_locks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_locks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comments_broadcast_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."comments_broadcast_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comments_broadcast_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_user_profile_on_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_user_profile_on_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_user_profile_on_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_comment_descendants"("parent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_comment_descendants"("parent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_comment_descendants"("parent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_accessible_comment_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_accessible_comment_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_accessible_comment_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hard_delete_comment_tree"("p_comment_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hard_delete_comment_tree"("p_comment_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hard_delete_comment_tree"("p_comment_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_user_accessible_scripts"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_user_accessible_scripts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_user_accessible_scripts"() TO "service_role";



GRANT ALL ON TABLE "public"."scripts" TO "anon";
GRANT ALL ON TABLE "public"."scripts" TO "authenticated";
GRANT ALL ON TABLE "public"."scripts" TO "service_role";



GRANT ALL ON FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "text", "p_plain_text" "text", "p_components" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "text", "p_plain_text" "text", "p_components" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_script_with_components"("p_script_id" "uuid", "p_yjs_state" "text", "p_plain_text" "text", "p_components" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_cleanup_project_comments"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_cleanup_project_comments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_cleanup_project_comments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_script_status"("p_script_id" "uuid", "p_new_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_script_status"("p_script_id" "uuid", "p_new_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_script_status"("p_script_id" "uuid", "p_new_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."dropdown_options" TO "anon";
GRANT ALL ON TABLE "public"."dropdown_options" TO "authenticated";
GRANT ALL ON TABLE "public"."dropdown_options" TO "service_role";



GRANT ALL ON TABLE "public"."hard_delete_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."hard_delete_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."hard_delete_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."scene_planning_state" TO "anon";
GRANT ALL ON TABLE "public"."scene_planning_state" TO "authenticated";
GRANT ALL ON TABLE "public"."scene_planning_state" TO "service_role";



GRANT ALL ON TABLE "public"."script_components" TO "anon";
GRANT ALL ON TABLE "public"."script_components" TO "authenticated";
GRANT ALL ON TABLE "public"."script_components" TO "service_role";



GRANT ALL ON TABLE "public"."script_locks" TO "anon";
GRANT ALL ON TABLE "public"."script_locks" TO "authenticated";
GRANT ALL ON TABLE "public"."script_locks" TO "service_role";



GRANT ALL ON TABLE "public"."videos" TO "anon";
GRANT ALL ON TABLE "public"."videos" TO "authenticated";
GRANT ALL ON TABLE "public"."videos" TO "service_role";



GRANT ALL ON TABLE "public"."scripts_with_eav" TO "anon";
GRANT ALL ON TABLE "public"."scripts_with_eav" TO "authenticated";
GRANT ALL ON TABLE "public"."scripts_with_eav" TO "service_role";



GRANT ALL ON TABLE "public"."shots" TO "anon";
GRANT ALL ON TABLE "public"."shots" TO "authenticated";
GRANT ALL ON TABLE "public"."shots" TO "service_role";



GRANT ALL ON TABLE "public"."user_clients" TO "anon";
GRANT ALL ON TABLE "public"."user_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."user_clients" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_accessible_scripts" TO "anon";
GRANT ALL ON TABLE "public"."user_accessible_scripts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_accessible_scripts" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
