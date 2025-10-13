-- Fix RLS infinite recursion issue
-- Technical Architect: Critical fix for circular dependency in RLS policies

-- Drop all existing policies on user_profiles first
DROP POLICY IF EXISTS "users_read_own_profile" ON "public"."user_profiles";
DROP POLICY IF EXISTS "admin_read_all_profiles" ON "public"."user_profiles";
DROP POLICY IF EXISTS "admin_update_profiles" ON "public"."user_profiles";

-- Create a simple, non-recursive policy for user_profiles
-- Users can ALWAYS read their own profile without any role check
CREATE POLICY "users_read_own_profile" ON "public"."user_profiles"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own_profile" ON "public"."user_profiles"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Now fix the projects policy to avoid recursion
-- Use a more efficient approach with a single subquery
DROP POLICY IF EXISTS "admin_full_access" ON "public"."projects";
DROP POLICY IF EXISTS "client_read_only" ON "public"."projects";

-- Projects: Check role directly from user_profiles without recursion
CREATE POLICY "projects_access" ON "public"."projects"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  CASE
    -- Admin users get full access
    WHEN (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
    THEN true
    -- Client users get read-only access to their projects
    WHEN (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
    THEN client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
    )
    -- Default: no access
    ELSE false
  END
)
WITH CHECK (
  -- Only admins can insert/update/delete
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Fix videos policies similarly
DROP POLICY IF EXISTS "admin_full_access" ON "public"."videos";
DROP POLICY IF EXISTS "client_read_only" ON "public"."videos";

CREATE POLICY "videos_access" ON "public"."videos"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  CASE
    WHEN (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
    THEN true
    WHEN (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
    THEN EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = videos.project_id
      AND p.client_filter IN (
        SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
      )
    )
    ELSE false
  END
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Fix scripts policies
DROP POLICY IF EXISTS "admin_full_access" ON "public"."scripts";
DROP POLICY IF EXISTS "client_read_only" ON "public"."scripts";

CREATE POLICY "scripts_access" ON "public"."scripts"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  CASE
    WHEN (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
    THEN true
    WHEN (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
    THEN EXISTS (
      SELECT 1
      FROM videos v
      JOIN projects p ON p.id = v.project_id
      WHERE v.id = scripts.video_id
      AND p.client_filter IN (
        SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
      )
    )
    ELSE false
  END
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Fix script_components policies
DROP POLICY IF EXISTS "admin_full_access" ON "public"."script_components";
DROP POLICY IF EXISTS "client_read_only" ON "public"."script_components";

CREATE POLICY "script_components_access" ON "public"."script_components"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  CASE
    WHEN (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
    THEN true
    WHEN (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
    THEN EXISTS (
      SELECT 1
      FROM scripts s
      JOIN videos v ON v.id = s.video_id
      JOIN projects p ON p.id = v.project_id
      WHERE s.id = script_components.script_id
      AND p.client_filter IN (
        SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
      )
    )
    ELSE false
  END
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Simplify user_clients policy
DROP POLICY IF EXISTS "admin_manage_user_clients" ON "public"."user_clients";

CREATE POLICY "admin_only_user_clients" ON "public"."user_clients"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Add a function to safely get user role (optional optimization)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;