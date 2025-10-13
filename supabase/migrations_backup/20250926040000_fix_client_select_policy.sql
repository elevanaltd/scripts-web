-- Fix client SELECT access for projects
-- Technical Architect: Fixing client read-only access issue

-- Drop the combined policy
DROP POLICY IF EXISTS "projects_access" ON "public"."projects";

-- Create separate policies for better clarity and debugging
-- Admin users: full access
CREATE POLICY "projects_admin_all" ON "public"."projects"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- Client users: SELECT only for their projects
CREATE POLICY "projects_client_select" ON "public"."projects"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
  AND
  client_filter IN (
    SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
  )
);

-- Similarly for videos
DROP POLICY IF EXISTS "videos_access" ON "public"."videos";

CREATE POLICY "videos_admin_all" ON "public"."videos"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

CREATE POLICY "videos_client_select" ON "public"."videos"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
  AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = videos.project_id
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
    )
  )
);

-- Similarly for scripts
DROP POLICY IF EXISTS "scripts_access" ON "public"."scripts";

CREATE POLICY "scripts_admin_all" ON "public"."scripts"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

CREATE POLICY "scripts_client_select" ON "public"."scripts"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
  AND
  EXISTS (
    SELECT 1
    FROM videos v
    JOIN projects p ON p.id = v.project_id
    WHERE v.id = scripts.video_id
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
    )
  )
);

-- Similarly for script_components
DROP POLICY IF EXISTS "script_components_access" ON "public"."script_components";

CREATE POLICY "script_components_admin_all" ON "public"."script_components"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

CREATE POLICY "script_components_client_select" ON "public"."script_components"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
  AND
  EXISTS (
    SELECT 1
    FROM scripts s
    JOIN videos v ON v.id = s.video_id
    JOIN projects p ON p.id = v.project_id
    WHERE s.id = script_components.script_id
    AND p.client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
    )
  )
);

-- Debug function to check client access
CREATE OR REPLACE FUNCTION debug_client_access(user_uuid UUID)
RETURNS TABLE (
  user_role TEXT,
  client_filters TEXT[],
  matching_projects JSON
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH user_info AS (
    SELECT role FROM user_profiles WHERE id = user_uuid
  ),
  user_filters AS (
    SELECT array_agg(client_filter) as filters
    FROM user_clients
    WHERE user_id = user_uuid
  ),
  matching AS (
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'title', p.title,
        'client_filter', p.client_filter
      )
    ) as projects
    FROM projects p
    WHERE p.client_filter IN (
      SELECT client_filter FROM user_clients WHERE user_id = user_uuid
    )
  )
  SELECT
    (SELECT role FROM user_info),
    (SELECT filters FROM user_filters),
    (SELECT projects FROM matching);
$$;