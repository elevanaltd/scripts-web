-- Fix RLS policies to properly handle authenticated users
-- The issue: RLS policies are blocking even authenticated users from seeing data
-- Solution: Ensure policies work correctly with authenticated users

-- First, let's drop the problematic policies and recreate them properly

-- Drop existing policies on scripts table
DROP POLICY IF EXISTS "Script access through videos" ON "public"."scripts";
DROP POLICY IF EXISTS "Users can manage scripts" ON "public"."scripts";
DROP POLICY IF EXISTS "scripts_admin_all" ON "public"."scripts";
DROP POLICY IF EXISTS "scripts_client_select" ON "public"."scripts";
DROP POLICY IF EXISTS "scripts_admin_full_access" ON "public"."scripts";
DROP POLICY IF EXISTS "scripts_client_read" ON "public"."scripts";

-- Drop existing policies on videos table
DROP POLICY IF EXISTS "Video access through projects" ON "public"."videos";
DROP POLICY IF EXISTS "videos_admin_all" ON "public"."videos";
DROP POLICY IF EXISTS "videos_client_select" ON "public"."videos";
DROP POLICY IF EXISTS "videos_admin_full_access" ON "public"."videos";
DROP POLICY IF EXISTS "videos_client_read" ON "public"."videos";

-- Drop existing policies on projects table
DROP POLICY IF EXISTS "Client project access" ON "public"."projects";
DROP POLICY IF EXISTS "projects_admin_all" ON "public"."projects";
DROP POLICY IF EXISTS "projects_client_select" ON "public"."projects";
DROP POLICY IF EXISTS "projects_admin_full_access" ON "public"."projects";
DROP POLICY IF EXISTS "projects_client_read" ON "public"."projects";

-- Projects policies
-- Admin users can do everything
CREATE POLICY "projects_admin_full_access" ON "public"."projects"
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

-- Client users can only read their assigned projects
CREATE POLICY "projects_client_read" ON "public"."projects"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'client'
  )
  AND EXISTS (
    SELECT 1 FROM user_clients
    WHERE user_clients.user_id = auth.uid()
    AND user_clients.client_filter = projects.client_filter
  )
);

-- Videos policies
-- Admin users can do everything
CREATE POLICY "videos_admin_full_access" ON "public"."videos"
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

-- Client users can only read videos from their projects
-- Updated to use eav_code relationship instead of project_id
CREATE POLICY "videos_client_read" ON "public"."videos"
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
    FROM projects p
    JOIN user_clients uc ON uc.client_filter = p.client_filter
    WHERE p.eav_code = videos.eav_code
    AND uc.user_id = auth.uid()
  )
);

-- Scripts policies
-- Admin users can do everything
CREATE POLICY "scripts_admin_full_access" ON "public"."scripts"
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

-- Client users can only read scripts from videos in their projects
CREATE POLICY "scripts_client_read" ON "public"."scripts"
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
    JOIN projects p ON p.eav_code = v.eav_code
    JOIN user_clients uc ON uc.client_filter = p.client_filter
    WHERE v.id = scripts.video_id
    AND uc.user_id = auth.uid()
  )
);

-- Script components policies remain as is
-- User profiles policies remain as is
-- User clients policies remain as is

-- Now let's also ensure that the default user has the admin role properly set
-- This is for development/testing purposes
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'shaun@eleven.ltd'
AND role IS NULL;