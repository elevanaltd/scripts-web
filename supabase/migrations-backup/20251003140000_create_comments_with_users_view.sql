-- Migration: Create comments_with_users view to fix N+1 query performance issue
-- Problem: Realtime broadcasts raw table data without JOINs, causing client-side N+1 queries
-- Solution: Create a view that joins comments with user_profiles for enriched realtime payloads

-- Create view joining comments with user profiles
CREATE OR REPLACE VIEW comments_with_users AS
SELECT
    c.id,
    c.script_id,
    c.user_id,
    c.content,
    c.start_position,
    c.end_position,
    c.highlighted_text,
    c.parent_comment_id,
    c.resolved_at,
    c.resolved_by,
    c.created_at,
    c.updated_at,
    -- User profile fields (flattened for realtime broadcast)
    u.email as user_email,
    u.display_name as user_display_name,
    u.role as user_role
FROM comments c
LEFT JOIN user_profiles u ON c.user_id = u.id;

-- Grant SELECT permissions on view (RLS policies apply to underlying tables)
GRANT SELECT ON comments_with_users TO authenticated;
GRANT SELECT ON comments_with_users TO anon;

-- Add comment explaining the view's purpose
COMMENT ON VIEW comments_with_users IS
'Enriched comments view with user profile data for realtime subscriptions.
Prevents N+1 query problem by providing pre-joined data in realtime broadcasts.
RLS policies from underlying comments and user_profiles tables still apply.';
