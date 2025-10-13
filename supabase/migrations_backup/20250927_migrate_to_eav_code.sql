-- Migration: Replace project_id with eav_code in videos table
-- Date: 2025-09-27
-- Purpose: Videos should link to projects via eav_code field (from SmartSuite lookup)

-- Step 1: Add eav_code column if it doesn't exist
ALTER TABLE "public"."videos"
ADD COLUMN IF NOT EXISTS "eav_code" TEXT;

-- Step 2: Drop the foreign key constraint on project_id
ALTER TABLE "public"."videos"
DROP CONSTRAINT IF EXISTS "videos_project_id_fkey";

-- Step 3: Drop the old project_id column
ALTER TABLE "public"."videos"
DROP COLUMN IF EXISTS "project_id";

-- Step 4: Add foreign key constraint on eav_code
ALTER TABLE "public"."videos"
ADD CONSTRAINT "videos_eav_code_fkey"
FOREIGN KEY ("eav_code")
REFERENCES "public"."projects"("eav_code")
ON DELETE SET NULL;

-- Step 5: Update RLS policies
DROP POLICY IF EXISTS "Video access through projects" ON "public"."videos";

-- Create new policy that uses eav_code relationship
CREATE POLICY "Video access through projects" ON "public"."videos"
FOR SELECT
TO "authenticated"
USING (
  EXISTS (
    SELECT 1
    FROM "public"."projects"
    WHERE "projects"."eav_code" = "videos"."eav_code"
  )
);

-- Step 6: Update the client access policies to use eav_code
DROP POLICY IF EXISTS "videos_client_select" ON "public"."videos";

CREATE POLICY "videos_client_select" ON "public"."videos"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'client'
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.eav_code = videos.eav_code
    AND p.client_filter IN (
      SELECT client_filter
      FROM user_clients
      WHERE user_id = auth.uid()
    )
  )
);

-- Step 7: Update admin policy (if needed)
DROP POLICY IF EXISTS "videos_admin_all" ON "public"."videos";

CREATE POLICY "videos_admin_all" ON "public"."videos"
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid() LIMIT 1) = 'admin'
);