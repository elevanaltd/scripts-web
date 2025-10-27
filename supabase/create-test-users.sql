-- Simple Test Users Setup for Local Supabase
-- Run: psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < supabase/create-test-users.sql

-- Test Admin User
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin.test@example.com';

  IF admin_user_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'admin.test@example.com', crypt('test-password-admin-123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"role": "admin"}', 'authenticated', 'authenticated'
    ) RETURNING id INTO admin_user_id;
  END IF;

  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (admin_user_id, 'admin.test@example.com', 'Test Admin User', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'Test Admin User';
END $$;

-- Test Client User
DO $$
DECLARE
  client_user_id uuid;
BEGIN
  SELECT id INTO client_user_id FROM auth.users WHERE email = 'client.test@example.com';

  IF client_user_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'client.test@example.com', crypt('test-password-client-123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"role": "client"}', 'authenticated', 'authenticated'
    ) RETURNING id INTO client_user_id;
  END IF;

  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (client_user_id, 'client.test@example.com', 'Test Client User', 'client')
  ON CONFLICT (id) DO UPDATE SET role = 'client', display_name = 'Test Client User';
END $$;

-- Test Unauthorized User
DO $$
DECLARE
  unauth_user_id uuid;
BEGIN
  SELECT id INTO unauth_user_id FROM auth.users WHERE email = 'test-unauthorized@external.com';

  IF unauth_user_id IS NULL THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
    ) VALUES (
      gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'test-unauthorized@external.com', crypt('test-unauthorized-password-123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"role": "client"}', 'authenticated', 'authenticated'
    ) RETURNING id INTO unauth_user_id;
  END IF;

  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (unauth_user_id, 'test-unauthorized@external.com', 'Test Unauthorized User', 'client')
  ON CONFLICT (id) DO UPDATE SET role = 'client', display_name = 'Test Unauthorized User';
END $$;

-- Verify
SELECT u.email, up.role, up.display_name
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE u.email LIKE '%test%'
ORDER BY u.email;
