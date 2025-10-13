-- Test Users Setup for Local Supabase
-- Run this script against LOCAL Supabase ONLY
-- Command: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < supabase/test-users-setup.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- STEP 1: Create test users in auth.users
-- ============================================================================

-- Test Admin User
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'test-admin@elevana.com';

  IF admin_user_id IS NULL THEN
    -- Create new admin user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role
    ) VALUES (
      uuid_generate_v4(),
      '00000000-0000-0000-0000-000000000000',
      'test-admin@elevana.com',
      crypt('test-admin-password-123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"role": "admin"}',
      'authenticated',
      'authenticated'
    )
    RETURNING id INTO admin_user_id;

    RAISE NOTICE 'Created admin user: %', admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user already exists: %', admin_user_id;
  END IF;
END $$;

-- Test Client User
DO $$
DECLARE
  client_user_id uuid;
BEGIN
  SELECT id INTO client_user_id FROM auth.users WHERE email = 'test-client@external.com';

  IF client_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role
    ) VALUES (
      uuid_generate_v4(),
      '00000000-0000-0000-0000-000000000000',
      'test-client@external.com',
      crypt('test-client-password-123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"role": "client"}',
      'authenticated',
      'authenticated'
    )
    RETURNING id INTO client_user_id;

    RAISE NOTICE 'Created client user: %', client_user_id;
  ELSE
    RAISE NOTICE 'Client user already exists: %', client_user_id;
  END IF;
END $$;

-- Test Unauthorized User
DO $$
DECLARE
  unauth_user_id uuid;
BEGIN
  SELECT id INTO unauth_user_id FROM auth.users WHERE email = 'test-unauthorized@external.com';

  IF unauth_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role
    ) VALUES (
      uuid_generate_v4(),
      '00000000-0000-0000-0000-000000000000',
      'test-unauthorized@external.com',
      crypt('test-unauthorized-password-123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"role": "none"}',
      'authenticated',
      'authenticated'
    )
    RETURNING id INTO unauth_user_id;

    RAISE NOTICE 'Created unauthorized user: %', unauth_user_id;
  ELSE
    RAISE NOTICE 'Unauthorized user already exists: %', unauth_user_id;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create user profiles in public.user_profiles
-- ============================================================================

-- Admin profile
INSERT INTO public.user_profiles (id, email, display_name, role, created_at, updated_at)
SELECT
  id,
  email,
  'Test Admin User',
  'admin',
  now(),
  now()
FROM auth.users
WHERE email = 'test-admin@elevana.com'
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = now();

-- Client profile
INSERT INTO public.user_profiles (id, email, display_name, role, created_at, updated_at)
SELECT
  id,
  email,
  'Test Client User',
  'client',
  now(),
  now()
FROM auth.users
WHERE email = 'test-client@external.com'
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = now();

-- Unauthorized profile
INSERT INTO public.user_profiles (id, email, display_name, role, created_at, updated_at)
SELECT
  id,
  email,
  'Test Unauthorized User',
  'none',
  now(),
  now()
FROM auth.users
WHERE email = 'test-unauthorized@external.com'
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  updated_at = now();

-- ============================================================================
-- STEP 3: Create test project, video, and script (if not exists)
-- ============================================================================

-- Test Project
INSERT INTO public.projects (id, name, eav_code, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Project',
  'TEST-PROJ',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Test Video
INSERT INTO public.videos (id, project_id, title, eav_code, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Test Video',
  'TEST-VID',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Test Script (matching the ID from comments.test.ts)
INSERT INTO public.scripts (id, video_id, content, version, created_at, updated_at)
VALUES (
  '0395f3f7-8eb7-4a1f-aa17-27d0d3a38680',
  '22222222-2222-2222-2222-222222222222',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"This is test script content for integration tests."}]}]}',
  1,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: Create client assignments for test users
-- ============================================================================

-- Assign test client to test project
INSERT INTO public.user_clients (user_id, project_id, created_at)
SELECT
  u.id,
  '11111111-1111-1111-1111-111111111111',
  now()
FROM auth.users u
WHERE u.email = 'test-client@external.com'
ON CONFLICT (user_id, project_id) DO NOTHING;

-- ============================================================================
-- Verification
-- ============================================================================

-- Show created users
SELECT
  u.email,
  up.role,
  up.display_name
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE u.email LIKE '%test%'
ORDER BY u.email;

RAISE NOTICE '✅ Test users setup complete!';
RAISE NOTICE 'Test users:';
RAISE NOTICE '  - test-admin@elevana.com (password: test-admin-password-123)';
RAISE NOTICE '  - test-client@external.com (password: test-client-password-123)';
RAISE NOTICE '  - test-unauthorized@external.com (password: test-unauthorized-password-123)';
