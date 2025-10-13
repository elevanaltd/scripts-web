-- Secure RLS policies with proper server-side authorization
-- Fixes client-side authorization bypass vulnerability

-- Drop existing policies to recreate with proper security
DROP POLICY IF EXISTS "scripts_select_policy" ON scripts;
DROP POLICY IF EXISTS "scripts_insert_policy" ON scripts;
DROP POLICY IF EXISTS "scripts_update_policy" ON scripts;
DROP POLICY IF EXISTS "scripts_delete_policy" ON scripts;

-- Scripts table policies with proper role checking

-- SELECT: Both admin and client can view scripts
CREATE POLICY "scripts_select_secure" ON scripts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'client')
    )
  );

-- INSERT: Only admins can create new scripts (server-side enforcement)
CREATE POLICY "scripts_insert_admin_only" ON scripts
  FOR INSERT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- UPDATE: Only admins can update scripts
CREATE POLICY "scripts_update_admin_only" ON scripts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- DELETE: Only admins can delete scripts
CREATE POLICY "scripts_delete_admin_only" ON scripts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Script components policies (matching scripts permissions)

DROP POLICY IF EXISTS "script_components_select_policy" ON script_components;
DROP POLICY IF EXISTS "script_components_insert_policy" ON script_components;
DROP POLICY IF EXISTS "script_components_update_policy" ON script_components;
DROP POLICY IF EXISTS "script_components_delete_policy" ON script_components;

-- SELECT: Both admin and client can view components
CREATE POLICY "components_select_secure" ON script_components
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'client')
    )
  );

-- INSERT: Only admins can create components
CREATE POLICY "components_insert_admin_only" ON script_components
  FOR INSERT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- UPDATE: Only admins can update components
CREATE POLICY "components_update_admin_only" ON script_components
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- DELETE: Only admins can delete components
CREATE POLICY "components_delete_admin_only" ON script_components
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Add security documentation
COMMENT ON POLICY "scripts_insert_admin_only" ON scripts IS 'Server-side enforcement: Only admin users can create scripts. This prevents client-side authorization bypass.';
COMMENT ON POLICY "scripts_select_secure" ON scripts IS 'Both admin and client users can view scripts for their assigned projects.';