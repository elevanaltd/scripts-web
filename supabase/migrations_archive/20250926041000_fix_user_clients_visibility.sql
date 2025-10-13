-- Fix user_clients visibility for client users
-- Technical Architect: Critical fix - clients need to see their own access entries

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "admin_only_user_clients" ON "public"."user_clients";

-- Create new policies for user_clients
-- Admin can see and manage all entries
CREATE POLICY "user_clients_admin_all" ON "public"."user_clients"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);

-- CRITICAL: Users can see their OWN user_clients entries
CREATE POLICY "user_clients_own_read" ON "public"."user_clients"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);

-- Debug: Let's also add logging to see what's happening
CREATE OR REPLACE FUNCTION check_client_access()
RETURNS TABLE (
  current_user_id UUID,
  current_user_role TEXT,
  client_filters TEXT[],
  can_see_user_clients BOOLEAN,
  can_see_projects BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    auth.uid() as current_user_id,
    (SELECT role FROM user_profiles WHERE id = auth.uid()) as current_user_role,
    ARRAY(SELECT client_filter FROM user_clients WHERE user_id = auth.uid()) as client_filters,
    EXISTS(SELECT 1 FROM user_clients WHERE user_id = auth.uid()) as can_see_user_clients,
    EXISTS(
      SELECT 1 FROM projects p
      WHERE p.client_filter IN (
        SELECT client_filter FROM user_clients WHERE user_id = auth.uid()
      )
    ) as can_see_projects;
END;
$$;