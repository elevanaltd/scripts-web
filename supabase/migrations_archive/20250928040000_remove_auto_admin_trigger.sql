-- Remove the dangerous auto-admin trigger that was granting admin to all users
-- This is a critical security fix

-- Drop the trigger that auto-assigns admin role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function that was creating admin profiles
DROP FUNCTION IF EXISTS public.ensure_user_profile_on_signup();

-- Create a safer function that creates client profiles by default
CREATE OR REPLACE FUNCTION public.create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if it doesn't exist
  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'client'  -- Default to client role for security
  )
  ON CONFLICT (id) DO NOTHING;  -- Don't override existing profiles

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger with the safer function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile_on_signup();

-- Manually grant admin role only to specific development users
-- Replace with your actual admin email addresses
UPDATE user_profiles
SET role = 'admin'
WHERE email IN (
  'admin@example.com',  -- Replace with actual admin emails
  'dev@example.com'     -- Add your development admin accounts here
);

-- Add a comment explaining the security model
COMMENT ON TABLE user_profiles IS 'User profiles with role-based access control. Default role is "client" for security. Admin role must be explicitly granted.';