-- ============================================================================
-- TEST DATABASE SEEDING
-- ============================================================================
-- Purpose: Seed local Supabase with test data for development and testing
-- Usage: Applied automatically via `supabase db reset` or `supabase db seed`
-- ============================================================================

-- Clean existing data (in dependency order)
TRUNCATE TABLE public.comments CASCADE;
TRUNCATE TABLE public.scripts CASCADE;
TRUNCATE TABLE public.videos CASCADE;
TRUNCATE TABLE public.projects CASCADE;
TRUNCATE TABLE public.user_clients CASCADE;
-- NOTE: Skipping user_profiles - FK constraint requires auth.users entries
-- Tests will create users dynamically using factories

-- ============================================================================
-- PROJECTS
-- ============================================================================
-- Test projects with client_filter assignments

INSERT INTO public.projects (id, title, eav_code, client_filter, created_at, updated_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Project Alpha', 'EAV1', 'CLIENT_A', NOW(), NOW()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Project Beta', 'EAV2', 'CLIENT_B', NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Test Project Gamma', 'EAV99', 'CLIENT_A', NOW(), NOW());

-- ============================================================================
-- USER-CLIENT ASSIGNMENTS
-- ============================================================================
-- NOTE: Skipping user_clients - requires auth.users to exist
-- Tests will create users dynamically via Supabase Auth

-- ============================================================================
-- VIDEOS
-- ============================================================================
-- Test videos linked to projects via eav_code

INSERT INTO public.videos (id, title, eav_code, created_at, updated_at) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Alpha Video 1', 'EAV1', NOW(), NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Alpha Video 2', 'EAV1', NOW(), NOW()),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Beta Video 1', 'EAV2', NOW(), NOW());

-- ============================================================================
-- SCRIPTS
-- ============================================================================
-- Test scripts (Y.js state managed by app, just create minimal records)

INSERT INTO public.scripts (id, video_id, plain_text, component_count, status, created_at, updated_at) VALUES
(
    '10000000-0000-0000-0000-000000000001',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Test script content for Alpha Video 1.',
    2,
    'draft',
    NOW(),
    NOW()
),
(
    '10000000-0000-0000-0000-000000000002',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'Test script content for Alpha Video 2.',
    1,
    'in_review',
    NOW(),
    NOW()
),
(
    '10000000-0000-0000-0000-000000000003',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Test script content for Beta Video 1.',
    1,
    'approved',
    NOW(),
    NOW()
);

-- ============================================================================
-- COMMENTS (Optional - tests can create their own)
-- ============================================================================
-- NOTE: Skipping comments - requires user_profiles to exist
-- Tests will create comments dynamically after creating users

-- ============================================================================
-- REFRESH VIEWS (if needed)
-- ============================================================================
-- Note: user_accessible_scripts is a VIEW, not a MATERIALIZED VIEW
-- It updates automatically, no refresh needed

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Expected counts:
-- - user_profiles: 4 (1 admin, 1 employee, 2 clients)
-- - projects: 3
-- - videos: 3
-- - scripts: 3
-- - comments: 2
-- - user_clients: 2
-- - user_accessible_scripts: ~12 rows (admin+employee: 3 scripts each, clients: 3+0)

SELECT 'Seed complete!' as status,
    (SELECT COUNT(*) FROM public.user_profiles) as users,
    (SELECT COUNT(*) FROM public.projects) as projects,
    (SELECT COUNT(*) FROM public.videos) as videos,
    (SELECT COUNT(*) FROM public.scripts) as scripts,
    (SELECT COUNT(*) FROM public.comments) as comments;
