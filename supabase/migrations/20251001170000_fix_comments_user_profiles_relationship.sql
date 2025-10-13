-- ============================================================================
-- FIX: Add direct foreign key relationship for comments → user_profiles
-- ============================================================================
-- Date: 2025-10-01
-- Purpose: Enable Supabase embedded joins for user:user_profiles(...)
-- Root Cause: Comments FK to auth.users but query joins to user_profiles
-- Solution: Add explicit FK from comments.user_id to user_profiles.id
-- ============================================================================

-- Step 1: Drop the existing FK to auth.users
-- (We'll replace it with FK to user_profiles which itself FKs to auth.users)
ALTER TABLE public.comments
DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

-- Step 2: Add new FK directly to user_profiles
-- This enables Supabase to recognize the relationship for embedded joins
ALTER TABLE public.comments
ADD CONSTRAINT comments_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.user_profiles(id)
ON DELETE SET NULL;

-- Step 3: Verify the relationship is recognized
-- Supabase will now understand: comments.user_id → user_profiles.id
-- This enables queries like: select=*,user:user_profiles(id,email,display_name,role)

-- Note: user_profiles already has FK to auth.users, so cascade behavior preserved
-- Data integrity flow: auth.users → user_profiles → comments
