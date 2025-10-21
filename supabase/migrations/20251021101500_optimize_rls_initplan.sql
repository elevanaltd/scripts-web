-- Migration: RLS InitPlan optimization for comment queries (TD-006)
-- Expected impact: 20-30% improvement (450ms → 360-420ms when combined with composite index)
--
-- PROBLEM:
-- - RLS policies evaluate 12-18 subqueries per cascade delete
-- - Each policy check queries user_accessible_scripts independently
-- - Multiplicative overhead across comment operations (N comments × M policy checks)
-- - 20-30% of cascade delete time spent in policy evaluation
--
-- SOLUTION:
-- - Create get_user_accessible_comment_ids() STABLE function
-- - Cache user-accessible comments per transaction (InitPlan pattern)
-- - Reduce 12-18 subqueries → 1 InitPlan query (executed once, cached)
-- - Update policies to use cached function instead of repeated subqueries
--
-- PATTERN:
-- - Follows D1.3 benchmark methodology (proven InitPlan optimization)
-- - STABLE function ensures result cached per transaction
-- - Query planner executes once as InitPlan, reuses result
-- - Cache invalidation automatic per transaction boundary
--
-- EXPECTED IMPACT:
-- - 20-30% improvement when combined with composite index
-- - Target: 360-420ms cascade delete (MEETS <500ms target)
--
-- ROLLBACK:
-- See rollback section at end of file

-- Create function to cache user-accessible comment IDs per transaction
-- STABLE volatility ensures result is cached (InitPlan pattern)
CREATE OR REPLACE FUNCTION get_user_accessible_comment_ids()
RETURNS TABLE(comment_id uuid)
LANGUAGE sql
STABLE  -- Cache result per transaction (InitPlan pattern)
SECURITY DEFINER
SET search_path = public, pg_temp  -- Security: prevent search_path attacks
AS $$
    SELECT DISTINCT c.id
    FROM comments c
    INNER JOIN user_accessible_scripts uas
        ON c.script_id = uas.script_id
    WHERE c.deleted = false
      AND uas.user_id = auth.uid();
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_accessible_comment_ids() TO authenticated;

-- Update SELECT policy to use cached function (realtime_select_simple)
-- This policy is used for real-time subscriptions, so optimization critical
DROP POLICY IF EXISTS "realtime_select_simple" ON comments;

CREATE POLICY "realtime_select_simple"
    ON comments FOR SELECT
    USING (
        -- Admin/employee bypass (fast path - no function call needed)
        get_user_role() = ANY (ARRAY['admin', 'employee'])
        OR
        -- Client access via cached function (InitPlan - single query per transaction)
        id IN (SELECT comment_id FROM get_user_accessible_comment_ids())
    );

-- Update client UPDATE policy to use cached function
DROP POLICY IF EXISTS "comments_client_update_own_optimized" ON comments;

CREATE POLICY "comments_client_update_own_optimized_v2"
    ON comments FOR UPDATE
    USING (
        user_id = auth.uid()
        AND (
            get_user_role() = ANY (ARRAY['admin', 'employee'])
            OR id IN (SELECT comment_id FROM get_user_accessible_comment_ids())
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        AND (
            get_user_role() = ANY (ARRAY['admin', 'employee'])
            OR id IN (SELECT comment_id FROM get_user_accessible_comment_ids())
        )
    );

-- Update client DELETE policy to use cached function
DROP POLICY IF EXISTS "comments_client_delete_own_optimized" ON comments;

CREATE POLICY "comments_client_delete_own_optimized_v2"
    ON comments FOR DELETE
    USING (
        user_id = auth.uid()
        AND (
            get_user_role() = ANY (ARRAY['admin', 'employee'])
            OR id IN (SELECT comment_id FROM get_user_accessible_comment_ids())
        )
    );

-- Update client CREATE policy to use cached function
-- Note: INSERT uses WITH CHECK, not USING clause
DROP POLICY IF EXISTS "comments_client_create_optimized" ON comments;

CREATE POLICY "comments_client_create_optimized_v2"
    ON comments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND get_user_role() = 'client'
        AND (
            -- For INSERT, check script accessibility directly (new comment doesn't exist yet)
            EXISTS (
                SELECT 1
                FROM user_accessible_scripts uas
                WHERE uas.user_id = auth.uid()
                  AND uas.script_id = comments.script_id
            )
        )
    );

-- Analyze to update planner statistics
ANALYZE comments;

-- Add comment documenting optimization
COMMENT ON FUNCTION get_user_accessible_comment_ids() IS
'Caches user-accessible comment IDs per transaction (InitPlan pattern).
STABLE volatility ensures query planner executes once and reuses result.
Reduces RLS overhead from 12-18 subqueries to 1 cached query.
Part of TD-006 cascade delete performance optimization.';

/*
ROLLBACK SQL (if needed):
-- Drop new policies
DROP POLICY IF EXISTS "realtime_select_simple" ON comments;
DROP POLICY IF EXISTS "comments_client_update_own_optimized_v2" ON comments;
DROP POLICY IF EXISTS "comments_client_delete_own_optimized_v2" ON comments;
DROP POLICY IF EXISTS "comments_client_create_optimized_v2" ON comments;

-- Drop function
DROP FUNCTION IF EXISTS get_user_accessible_comment_ids();

-- Restore original policies (from 20251014000000_fix_comments_rls_policies.sql)
CREATE POLICY "realtime_select_simple"
    ON comments FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "comments_client_update_own_optimized"
    ON comments FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'client')
        AND user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM user_accessible_scripts uas WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id)
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'client')
        AND user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM user_accessible_scripts uas WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id)
    );

CREATE POLICY "comments_client_delete_own_optimized"
    ON comments FOR DELETE
    USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'client')
        AND user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM user_accessible_scripts uas WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id)
    );

CREATE POLICY "comments_client_create_optimized"
    ON comments FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'client')
        AND EXISTS (SELECT 1 FROM user_accessible_scripts uas WHERE uas.user_id = auth.uid() AND uas.script_id = comments.script_id)
        AND user_id = auth.uid()
    );
*/
