-- Fix admin role assignment properly
-- This ensures that all authenticated users have admin role for development

-- First, ensure all existing auth users have profiles with admin role
INSERT INTO public.user_profiles (id, email, display_name, role)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) as display_name,
  'admin' as role
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET
  role = 'admin',  -- Force admin role for all users in development
  display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name);

-- Create or replace the trigger function to ensure admin role
CREATE OR REPLACE FUNCTION public.ensure_user_profile_on_signup()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'admin'  -- Always admin for development
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
    role = 'admin';  -- Force admin role even on conflict

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_user_profile_on_signup();

-- Also handle auth user updates (email changes, etc)
CREATE OR REPLACE FUNCTION public.ensure_user_profile_on_update()
RETURNS trigger AS $$
BEGIN
  -- Update user profile if auth user is updated
  UPDATE public.user_profiles
  SET
    email = NEW.email,
    display_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  WHERE id = NEW.id;

  -- If no profile exists (shouldn't happen), create one
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (id, email, display_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'admin'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auth user updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_user_profile_on_update();

-- Verify all users now have admin role
DO $$
DECLARE
  user_count INTEGER;
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  SELECT COUNT(*) INTO admin_count FROM user_profiles WHERE role = 'admin';

  RAISE NOTICE 'Total auth users: %, Users with admin role: %', user_count, admin_count;

  IF user_count != admin_count THEN
    RAISE WARNING 'Not all users have admin role! Running fix...';

    -- Force fix any missing profiles
    INSERT INTO public.user_profiles (id, email, display_name, role)
    SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', email), 'admin'
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM user_profiles WHERE role = 'admin')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  END IF;
END $$;