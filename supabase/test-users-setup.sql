-- ============================================================================
-- DEPRECATED (2025-11-25): Use Auth Admin API via tests/setup/create-test-users.ts
-- ============================================================================
--
-- MIGRATION NOTICE:
-- This SQL-based approach is deprecated in favor of Auth Admin API.
--
-- WHY DEPRECATED:
-- - SQL inserts bypass auth.identities table (creates orphaned users)
-- - Auth Admin API maintains system integrity (auth.users + auth.identities)
-- - CI infrastructure uses Auth Admin API via tests/setup/create-test-users.ts
--
-- CANONICAL SOURCE:
-- - tests/setup/create-test-users.ts (Auth Admin API)
-- - Credentials: admin.test@example.com, client.test@example.com
-- - Protocol: SUPABASE_PREVIEW_TESTING (v1.2.0)
--
-- USAGE (if you must use this file for legacy reasons):
-- psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < supabase/test-users-setup.sql
--
-- RECOMMENDED:
-- node tests/setup/create-test-users.mjs
--
-- ============================================================================

-- Test Users Setup for Local Supabase
-- Run this script against LOCAL Supabase ONLY

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
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin.test@example.com';

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
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      aud,
      role
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'admin.test@example.com',
      crypt('test-password-admin-123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '',
      '',
      '',
      '',
      'authenticated',
      'authenticated'
    );

    RAISE NOTICE 'Created test admin user: admin.test@example.com';
  ELSE
    RAISE NOTICE 'Test admin user already exists: admin.test@example.com';
  END IF;
END $$;

-- Test Client User
DO $$
DECLARE
  client_user_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO client_user_id FROM auth.users WHERE email = 'client.test@example.com';

  IF client_user_id IS NULL THEN
    -- Create new client user
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      aud,
      role
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'client.test@example.com',
      crypt('test-password-client-123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '',
      '',
      '',
      '',
      'authenticated',
      'authenticated'
    );

    RAISE NOTICE 'Created test client user: client.test@example.com';
  ELSE
    RAISE NOTICE 'Test client user already exists: client.test@example.com';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create user profiles in public.user_profiles
-- ============================================================================

DO $$
DECLARE
  admin_user_id uuid;
  client_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin.test@example.com';
  SELECT id INTO client_user_id FROM auth.users WHERE email = 'client.test@example.com';

  -- Admin profile
  INSERT INTO public.user_profiles (id, email, display_name, role, created_at, updated_at)
  VALUES (admin_user_id, 'admin.test@example.com', 'Test Admin User', 'admin', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    updated_at = now();

  -- Client profile
  INSERT INTO public.user_profiles (id, email, display_name, role, created_at, updated_at)
  VALUES (client_user_id, 'client.test@example.com', 'Test Client User', 'client', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    updated_at = now();

  RAISE NOTICE 'User profiles created/updated successfully';
END $$;

-- ============================================================================
-- STEP 3: Show created users
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Test users setup complete!';
  RAISE NOTICE '  - admin.test@example.com (password: test-password-admin-123)';
  RAISE NOTICE '  - client.test@example.com (password: test-password-client-123)';
  RAISE NOTICE '';
  RAISE NOTICE 'Login credentials for local testing:';
END $$;

-- Verify admin user
SELECT
  u.id,
  u.email,
  p.display_name,
  p.role
FROM auth.users u
JOIN public.user_profiles p ON u.id = p.id
WHERE email = 'admin.test@example.com'
LIMIT 1;

-- Verify client user
SELECT
  u.id,
  u.email,
  p.display_name,
  p.role
FROM auth.users u
JOIN public.user_profiles p ON u.id = p.id
WHERE email = 'client.test@example.com'
LIMIT 1;

-- Show client assignment (if any)
SELECT
  uc.user_id,
  u.email,
  uc.client_filter,
  COUNT(p.id) as accessible_projects
FROM public.user_clients uc
JOIN auth.users u ON uc.user_id = u.id
LEFT JOIN public.projects p ON p.client_filter = uc.client_filter
WHERE u.email = 'client.test@example.com'
GROUP BY uc.user_id, u.email, uc.client_filter;
