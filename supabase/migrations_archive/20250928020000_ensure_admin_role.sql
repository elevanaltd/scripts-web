-- Ensure the default development user has admin role
-- This fixes the RLS policy issue where scripts can't be created

-- First, let's check if user_profiles exist and update them
DO $$
BEGIN
  -- Update any existing users who don't have a role to be admin
  -- This is for development environment
  UPDATE user_profiles
  SET role = 'admin'
  WHERE role IS NULL;

  -- Specifically ensure shaun@eleven.ltd is admin
  UPDATE user_profiles
  SET role = 'admin'
  WHERE email = 'shaun@eleven.ltd';

  RAISE NOTICE 'Updated user roles to admin for development';
END $$;

-- Also create a trigger to automatically set new users as admin during development
-- This can be removed or modified for production
CREATE OR REPLACE FUNCTION ensure_user_profile_on_signup()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'admin'  -- Default to admin for development
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
    role = COALESCE(user_profiles.role, 'admin');  -- Only set if not already set

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile_on_signup();

-- Also ensure any existing auth users have profiles
INSERT INTO public.user_profiles (id, email, display_name, role)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email) as display_name,
  'admin' as role
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles)
ON CONFLICT (id) DO NOTHING;