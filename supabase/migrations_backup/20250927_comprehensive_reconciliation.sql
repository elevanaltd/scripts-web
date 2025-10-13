-- Comprehensive Database and RLS Reconciliation
-- Date: 2025-09-27
-- Purpose: Fix 406 errors by reconciling database schema and RLS policies
-- Technical Architect: Complete schema and policy alignment

-- ===============================================
-- PART 1: SCHEMA RECONCILIATION
-- ===============================================

-- Ensure videos table has eav_code column
ALTER TABLE "public"."videos"
ADD COLUMN IF NOT EXISTS "eav_code" TEXT;

-- Drop old foreign key if it exists
ALTER TABLE "public"."videos"
DROP CONSTRAINT IF EXISTS "videos_project_id_fkey";

-- Drop old project_id column if it exists
ALTER TABLE "public"."videos"
DROP COLUMN IF EXISTS "project_id";

-- Add foreign key constraint on eav_code (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'videos_eav_code_fkey'
  ) THEN
    ALTER TABLE "public"."videos"
    ADD CONSTRAINT "videos_eav_code_fkey"
    FOREIGN KEY ("eav_code")
    REFERENCES "public"."projects"("eav_code")
    ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure user_clients table exists with proper structure
CREATE TABLE IF NOT EXISTS "public"."user_clients" (
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "client_filter" TEXT NOT NULL,
  "granted_by" UUID REFERENCES auth.users(id),
  "granted_at" TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, client_filter)
);

-- ===============================================
-- PART 2: DROP ALL EXISTING RLS POLICIES
-- ===============================================

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admin and employee write access" ON "public"."projects";
DROP POLICY IF EXISTS "Authenticated users can read projects" ON "public"."projects";
DROP POLICY IF EXISTS "Client project access" ON "public"."projects";
DROP POLICY IF EXISTS "projects_access" ON "public"."projects";
DROP POLICY IF EXISTS "projects_admin_all" ON "public"."projects";
DROP POLICY IF EXISTS "projects_client_select" ON "public"."projects";
DROP POLICY IF EXISTS "admin_full_access" ON "public"."projects";
DROP POLICY IF EXISTS "client_read_only" ON "public"."projects";

DROP POLICY IF EXISTS "Authenticated users can read videos" ON "public"."videos";
DROP POLICY IF EXISTS "Video access through projects" ON "public"."videos";
DROP POLICY IF EXISTS "videos_access" ON "public"."videos";
DROP POLICY IF EXISTS "videos_admin_all" ON "public"."videos";
DROP POLICY IF EXISTS "videos_client_select" ON "public"."videos";
DROP POLICY IF EXISTS "admin_full_access" ON "public"."videos";
DROP POLICY IF EXISTS "client_read_only" ON "public"."videos";

DROP POLICY IF EXISTS "Script access through videos" ON "public"."scripts";
DROP POLICY IF EXISTS "Users can manage scripts" ON "public"."scripts";
DROP POLICY IF EXISTS "scripts_access" ON "public"."scripts";
DROP POLICY IF EXISTS "scripts_admin_all" ON "public"."scripts";
DROP POLICY IF EXISTS "scripts_client_select" ON "public"."scripts";
DROP POLICY IF EXISTS "admin_full_access" ON "public"."scripts";
DROP POLICY IF EXISTS "client_read_only" ON "public"."scripts";

DROP POLICY IF EXISTS "Users can manage components" ON "public"."script_components";
DROP POLICY IF EXISTS "script_components_access" ON "public"."script_components";
DROP POLICY IF EXISTS "script_components_admin_all" ON "public"."script_components";
DROP POLICY IF EXISTS "script_components_client_select" ON "public"."script_components";
DROP POLICY IF EXISTS "admin_full_access" ON "public"."script_components";
DROP POLICY IF EXISTS "client_read_only" ON "public"."script_components";

DROP POLICY IF EXISTS "Enable users to view their own data only" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can insert own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can read all profiles" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Users can update own profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "users_read_own_profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "users_update_own_profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "admin_read_all_profiles" ON "public"."user_profiles";
DROP POLICY IF EXISTS "admin_update_profiles" ON "public"."user_profiles";

DROP POLICY IF EXISTS "admin_manage_user_clients" ON "public"."user_clients";
DROP POLICY IF EXISTS "admin_only_user_clients" ON "public"."user_clients";
DROP POLICY IF EXISTS "user_clients_admin_all" ON "public"."user_clients";
DROP POLICY IF EXISTS "user_clients_own_read" ON "public"."user_clients";

-- ===============================================
-- PART 3: CREATE CLEAN RLS POLICIES
-- ===============================================

-- Helper function to get user role (more efficient than subqueries)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1
$$;

-- ======================
-- PROJECTS TABLE
-- ======================

-- Admin and employee: full access
CREATE POLICY "projects_admin_employee_all" ON "public"."projects"
FOR ALL
TO authenticated
USING (
  get_user_role() IN ('admin', 'employee')
)
WITH CHECK (
  get_user_role() IN ('admin', 'employee')
);

-- Client: read only their assigned projects
CREATE POLICY "projects_client_read" ON "public"."projects"
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'client'
  AND client_filter IN (
    SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
  )
);

-- ======================
-- VIDEOS TABLE
-- ======================

-- Admin and employee: full access
CREATE POLICY "videos_admin_employee_all" ON "public"."videos"
FOR ALL
TO authenticated
USING (
  get_user_role() IN ('admin', 'employee')
)
WITH CHECK (
  get_user_role() IN ('admin', 'employee')
);

-- Client: read videos from their projects (using eav_code)
CREATE POLICY "videos_client_read" ON "public"."videos"
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'client'
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.eav_code = videos.eav_code
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
    )
  )
);

-- ======================
-- SCRIPTS TABLE
-- ======================

-- Admin and employee: full access
CREATE POLICY "scripts_admin_employee_all" ON "public"."scripts"
FOR ALL
TO authenticated
USING (
  get_user_role() IN ('admin', 'employee')
)
WITH CHECK (
  get_user_role() IN ('admin', 'employee')
);

-- Client: read scripts from their videos
CREATE POLICY "scripts_client_read" ON "public"."scripts"
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'client'
  AND EXISTS (
    SELECT 1
    FROM videos v
    JOIN projects p ON p.eav_code = v.eav_code
    WHERE v.id = scripts.video_id
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
    )
  )
);

-- ======================
-- SCRIPT_COMPONENTS TABLE
-- ======================

-- Admin and employee: full access
CREATE POLICY "components_admin_employee_all" ON "public"."script_components"
FOR ALL
TO authenticated
USING (
  get_user_role() IN ('admin', 'employee')
)
WITH CHECK (
  get_user_role() IN ('admin', 'employee')
);

-- Client: read components from their scripts
CREATE POLICY "components_client_read" ON "public"."script_components"
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'client'
  AND EXISTS (
    SELECT 1
    FROM scripts s
    JOIN videos v ON v.id = s.video_id
    JOIN projects p ON p.eav_code = v.eav_code
    WHERE s.id = script_components.script_id
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
    )
  )
);

-- ======================
-- USER_PROFILES TABLE
-- ======================

-- Users can read their own profile
CREATE POLICY "profiles_read_own" ON "public"."user_profiles"
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON "public"."user_profiles"
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin can read all profiles
CREATE POLICY "profiles_admin_read_all" ON "public"."user_profiles"
FOR SELECT
TO authenticated
USING (get_user_role() = 'admin');

-- ======================
-- USER_CLIENTS TABLE
-- ======================

-- Admin: full access
CREATE POLICY "user_clients_admin_all" ON "public"."user_clients"
FOR ALL
TO authenticated
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

-- Users can read their own client assignments
CREATE POLICY "user_clients_read_own" ON "public"."user_clients"
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ===============================================
-- PART 4: VERIFY AND GRANT PERMISSIONS
-- ===============================================

-- Ensure RLS is enabled on all tables
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."scripts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."script_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sync_metadata" ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT ALL ON "public"."projects" TO authenticated;
GRANT ALL ON "public"."videos" TO authenticated;
GRANT ALL ON "public"."scripts" TO authenticated;
GRANT ALL ON "public"."script_components" TO authenticated;
GRANT ALL ON "public"."user_profiles" TO authenticated;
GRANT ALL ON "public"."user_clients" TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION "public"."save_script_with_components" TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."get_user_role" TO authenticated;

-- ===============================================
-- PART 5: CREATE EMPLOYEE/VIEWER DEFAULT POLICIES
-- ===============================================

-- Ensure we have policies for viewer role (read-only for everything they can access)
-- These would be similar to client but potentially with different filtering logic

-- Note: sync_metadata should only be accessible by admin/employee
CREATE POLICY "sync_metadata_admin_employee" ON "public"."sync_metadata"
FOR ALL
TO authenticated
USING (get_user_role() IN ('admin', 'employee'))
WITH CHECK (get_user_role() IN ('admin', 'employee'));

-- ===============================================
-- PART 6: DIAGNOSTIC VIEWS
-- ===============================================

-- Create a view to help diagnose access issues
CREATE OR REPLACE VIEW public.debug_user_access AS
SELECT
  auth.uid() as user_id,
  get_user_role() as user_role,
  (
    SELECT array_agg(client_filter)
    FROM user_clients
    WHERE user_id = auth.uid()
  ) as client_filters,
  (
    SELECT COUNT(*)
    FROM projects
    WHERE get_user_role() IN ('admin', 'employee')
      OR (
        get_user_role() = 'client'
        AND client_filter IN (
          SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
        )
      )
  ) as accessible_projects,
  (
    SELECT COUNT(*)
    FROM videos v
    WHERE get_user_role() IN ('admin', 'employee')
      OR EXISTS (
        SELECT 1 FROM projects p
        WHERE p.eav_code = v.eav_code
        AND p.client_filter IN (
          SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
        )
      )
  ) as accessible_videos;

-- Grant access to the debug view
GRANT SELECT ON public.debug_user_access TO authenticated;

-- ===============================================
-- NOTES FOR 406 ERROR RESOLUTION
-- ===============================================
-- The 406 error occurs when:
-- 1. RLS policies block the operation (returns empty result)
-- 2. The RPC function succeeds but returns no rows due to RLS
-- 3. Supabase interprets "no rows" as "not acceptable" (406)
--
-- This migration fixes:
-- 1. References to old project_id column (now using eav_code)
-- 2. Inconsistent role checking (now using helper function)
-- 3. Missing employee role policies
-- 4. Overly complex nested queries in policies
--
-- After this migration:
-- - Admin and Employee users have full access
-- - Client users have read-only access to their assigned content
-- - All queries use the efficient get_user_role() function
-- - Foreign keys properly use eav_code relationship