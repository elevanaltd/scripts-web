-- Debug client access for Berkeley Group
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check user profile and role for the client user
-- Replace 'client@example.com' with the actual client email
SELECT
  id,
  email,
  role,
  display_name
FROM user_profiles
WHERE email = 'client@example.com';  -- REPLACE WITH ACTUAL CLIENT EMAIL

-- 2. Check user_clients entries for this user
-- Replace the UUID with the actual user ID from above
SELECT
  uc.*,
  up.email,
  up.role
FROM user_clients uc
JOIN user_profiles up ON up.id = uc.user_id
WHERE up.email = 'client@example.com';  -- REPLACE WITH ACTUAL CLIENT EMAIL

-- 3. Check projects with Berkeley Group filter
SELECT
  id,
  title,
  client_filter,
  eav_code
FROM projects
WHERE client_filter = 'Berkeley Group';

-- 4. Check all unique client_filters in projects
SELECT DISTINCT client_filter
FROM projects
WHERE client_filter IS NOT NULL
ORDER BY client_filter;

-- 5. Test the RLS policy directly
-- Replace the UUID with the actual client user ID
SELECT debug_client_access('YOUR_CLIENT_USER_UUID_HERE'::UUID);

-- 6. Check if client can see projects when impersonating them
-- This simulates what the client should see
-- Replace UUID with actual client user ID
SELECT
  p.id,
  p.title,
  p.client_filter,
  p.eav_code
FROM projects p
WHERE p.client_filter IN (
  SELECT client_filter
  FROM user_clients
  WHERE user_id = 'YOUR_CLIENT_USER_UUID_HERE'::UUID
);

-- 7. Check exact string matching (case sensitivity)
SELECT
  p.title,
  p.client_filter,
  uc.client_filter as user_client_filter,
  p.client_filter = uc.client_filter as exact_match,
  lower(trim(p.client_filter)) = lower(trim(uc.client_filter)) as normalized_match
FROM projects p
CROSS JOIN user_clients uc
WHERE uc.user_id IN (SELECT id FROM user_profiles WHERE email = 'client@example.com')
ORDER BY p.title;