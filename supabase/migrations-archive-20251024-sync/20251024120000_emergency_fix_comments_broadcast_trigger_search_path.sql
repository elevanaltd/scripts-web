-- ============================================================================
-- EMERGENCY SECURITY FIX: CVE-2018-1058 Class Vulnerability
-- ============================================================================
-- Date: 2025-10-24
-- Severity: CRITICAL (10/10) - BLOCKING before any new deployments
-- Authority: Security-Specialist + Critical-Engineer
-- Vulnerability: comments_broadcast_trigger missing search_path protection
-- Attack Vector: Schema injection → privilege escalation to postgres superuser
-- Remediation: Add SET search_path TO '' per constitutional standard
-- ============================================================================

-- Fix: Add search_path protection to comments_broadcast_trigger
CREATE OR REPLACE FUNCTION "public"."comments_broadcast_trigger"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path TO ''  -- SECURITY FIX: Prevents CVE-2018-1058 class schema injection attacks
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

-- Document security fix for audit trail
COMMENT ON FUNCTION "public"."comments_broadcast_trigger"() IS
  'Emergency security fix 2025-10-24: Added SET search_path TO '''' to prevent CVE-2018-1058 class schema injection attacks.

   VULNERABILITY: SECURITY DEFINER functions without search_path allow attackers to create malicious
   schemas/functions that execute with elevated privileges (postgres superuser).

   REMEDIATION: All SECURITY DEFINER functions MUST set search_path per constitutional standard.

   Security-Specialist: CRITICAL vulnerability - privilege escalation to postgres superuser possible.
   Critical-Engineer: BLOCKING before any new deployments.

   Trigger: Broadcasts comment changes to realtime subscriptions on INSERT/UPDATE/DELETE.';
