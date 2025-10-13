-- Fix RLS policies to use user_profiles table for role checking
-- Technical Architect: Fixing security architecture to properly check roles from user_profiles table

-- Drop existing policies that rely on JWT claims
DROP POLICY IF EXISTS "admin_full_access" ON "public"."projects";
DROP POLICY IF EXISTS "client_read_only" ON "public"."projects";
DROP POLICY IF EXISTS "admin_full_access" ON "public"."videos";
DROP POLICY IF EXISTS "client_read_only" ON "public"."videos";
DROP POLICY IF EXISTS "admin_full_access" ON "public"."scripts";
DROP POLICY IF EXISTS "client_read_only" ON "public"."scripts";
DROP POLICY IF EXISTS "admin_full_access" ON "public"."script_components";
DROP POLICY IF EXISTS "client_read_only" ON "public"."script_components";

-- Enable RLS on all tables if not already enabled
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."scripts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."script_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_clients" ENABLE ROW LEVEL SECURITY;

-- Projects: Admin full access (check role from user_profiles)
CREATE POLICY "admin_full_access" ON "public"."projects"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Projects: Client read-only access based on client_filter
CREATE POLICY "client_read_only" ON "public"."projects"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'client'
  )
  AND client_filter IN (
    SELECT client_filter FROM user_clients
    WHERE user_id = auth.uid()
  )
);

-- Videos: Admin full access
CREATE POLICY "admin_full_access" ON "public"."videos"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Videos: Client read-only access inherits from project access
CREATE POLICY "client_read_only" ON "public"."videos"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'client'
  )
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = videos.project_id
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients
      WHERE user_id = auth.uid()
    )
  )
);

-- Scripts: Admin full access
CREATE POLICY "admin_full_access" ON "public"."scripts"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Scripts: Client read-only access inherits from video/project access
CREATE POLICY "client_read_only" ON "public"."scripts"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'client'
  )
  AND EXISTS (
    SELECT 1
    FROM videos v
    JOIN projects p ON p.id = v.project_id
    WHERE v.id = scripts.video_id
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients
      WHERE user_id = auth.uid()
    )
  )
);

-- Script Components: Admin full access
CREATE POLICY "admin_full_access" ON "public"."script_components"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Script Components: Client read-only access inherits from script access
CREATE POLICY "client_read_only" ON "public"."script_components"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'client'
  )
  AND EXISTS (
    SELECT 1
    FROM scripts s
    JOIN videos v ON v.id = s.video_id
    JOIN projects p ON p.id = v.project_id
    WHERE s.id = script_components.script_id
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients
      WHERE user_id = auth.uid()
    )
  )
);

-- User Profiles: Users can read their own profile
CREATE POLICY "users_read_own_profile" ON "public"."user_profiles"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- User Profiles: Admin can read all profiles
CREATE POLICY "admin_read_all_profiles" ON "public"."user_profiles"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- User Profiles: Admin can update any profile
CREATE POLICY "admin_update_profiles" ON "public"."user_profiles"
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- User Clients: Admin full access only
CREATE POLICY "admin_manage_user_clients" ON "public"."user_clients"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_role ON user_profiles(id, role);
CREATE INDEX IF NOT EXISTS idx_user_clients_user_id ON user_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_filter ON user_clients(client_filter);
CREATE INDEX IF NOT EXISTS idx_projects_client_filter ON projects(client_filter);