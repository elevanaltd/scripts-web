-- Critical-Engineer: consulted for Schema migration safety (shots table refactoring)
-- Verdict: GO (after corrections to UNIQUE constraint, missing index, and RLS policies)
-- Risk: HIGH if not deployed atomically with code updates
-- Date: 2025-10-27
-- Holistic-Orchestrator: Approved for scenes-web-demo-1 scope (cam-op mock-only confirmed)

-- Simplify shots schema: remove scene_planning_state middleman table
-- Current: shots.scene_id → scene_planning_state.id → scene_planning_state.script_component_id
-- New:     shots.script_component_id → script_components.id (direct reference)

BEGIN;

-- Pre-flight checks
DO $$
DECLARE
  duplicate_scenes INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_scenes
  FROM (
    SELECT script_component_id, COUNT(*) as cnt
    FROM scene_planning_state
    GROUP BY script_component_id
    HAVING COUNT(*) > 1
  ) dups;

  IF duplicate_scenes > 0 THEN
    RAISE EXCEPTION 'Migration blocked: % components have multiple scenes', duplicate_scenes;
  END IF;
END $$;

-- 1. Add new column (NO UNIQUE constraint - multiple shots per component allowed)
ALTER TABLE shots ADD COLUMN script_component_id UUID;

-- 2. Migrate data
UPDATE shots
SET script_component_id = scene_planning_state.script_component_id
FROM scene_planning_state
WHERE shots.scene_id = scene_planning_state.id;

-- 3. Verify migration succeeded
DO $$
DECLARE
  unmigrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmigrated_count
  FROM shots
  WHERE script_component_id IS NULL;

  IF unmigrated_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % shots have NULL script_component_id', unmigrated_count;
  END IF;
END $$;

-- 4. Set NOT NULL constraint
ALTER TABLE shots ALTER COLUMN script_component_id SET NOT NULL;

-- 5. Add foreign key
ALTER TABLE shots
ADD CONSTRAINT shots_script_component_id_fkey
FOREIGN KEY (script_component_id) REFERENCES script_components(id)
ON DELETE CASCADE;

-- 6. Create performance index (CRITICAL - prevents degradation)
CREATE INDEX idx_shots_script_component_id ON shots(script_component_id);

-- 7. Update RLS policies BEFORE dropping table (CRITICAL - prevents client lockout)
DROP POLICY IF EXISTS "client_select_shots" ON "public"."shots";

CREATE POLICY "client_select_shots" ON "public"."shots" FOR SELECT USING (
  EXISTS ( SELECT 1
   FROM "public"."script_components" "sc"
   JOIN "public"."scripts" "s" ON "sc"."script_id" = "s"."id"
   JOIN "public"."videos" "v" ON "s"."video_id" = "v"."id"
   WHERE "sc"."id" = "shots"."script_component_id"
     AND "v"."eav_code" IN (
       SELECT DISTINCT "user_clients"."client_filter"
       FROM "public"."user_clients"
       WHERE "user_clients"."user_id" = auth.uid()
     )
  )
);

DROP POLICY IF EXISTS "client_select_scene_planning_state" ON "public"."scene_planning_state";

-- 8. Drop old relationships (POINT OF NO RETURN)
ALTER TABLE shots DROP CONSTRAINT shots_scene_id_fkey;
ALTER TABLE shots DROP COLUMN scene_id;

-- 9. Drop unique constraint on scene_planning_state before dropping table
ALTER TABLE scene_planning_state DROP CONSTRAINT IF EXISTS scene_planning_state_script_component_id_key;

-- 10. Drop middleman table
DROP TABLE scene_planning_state;

COMMIT;
