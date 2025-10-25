-- ============================================================================
-- SUPABASE PREVIEW TESTING - BASELINE SEED DATA (Production-Aligned)
-- ============================================================================
-- Protocol: SUPABASE_PREVIEW_TESTING (v1.2.0)
-- Purpose: Realistic baseline mirroring production schema structure
-- Runs: ONCE at local db reset OR preview branch creation (NOT production)
--
-- SECURITY MANDATE: NO real user data, NO PII, NO production credentials
-- AUTH PATTERN: Test users created via Auth Admin API (NOT this file)
-- SCHEMA ALIGNMENT: Based on project zbxvjyrbkycbfhwmmnmy actual structure
-- PRODUCTION CONSTRAINT: Uses save_script_with_components() function (direct INSERT blocked)
-- ============================================================================

-- ============================================================================
-- BASELINE REFERENCE DATA
-- ============================================================================
-- Deterministic UUIDs for stable test relationships
-- Pattern: 00000000-0000-0000-0000-0000000000XX

-- Projects (2 test projects with realistic EAV codes and client filters)
INSERT INTO public.projects (id, title, eav_code, client_filter, created_at, updated_at) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'Test Project Alpha',
    'EAV1',
    'CLIENT_ALPHA',
    NOW(),
    NOW()
),
(
    '00000000-0000-0000-0000-000000000002',
    'Test Project Beta',
    'EAV2',
    'CLIENT_BETA',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Videos (3 test videos linked to projects via eav_code)
INSERT INTO public.videos (id, title, eav_code, created_at, updated_at) VALUES
(
    '00000000-0000-0000-0000-000000000011',
    'Alpha Video 1',
    'EAV1',
    NOW(),
    NOW()
),
(
    '00000000-0000-0000-0000-000000000012',
    'Alpha Video 2',
    'EAV1',
    NOW(),
    NOW()
),
(
    '00000000-0000-0000-0000-000000000021',
    'Beta Video 1',
    'EAV2',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SCRIPTS WITH COMPONENTS - PRODUCTION PATTERN
-- ============================================================================
-- CRITICAL: Must use save_script_with_components() function
-- Direct INSERT to script_components is BLOCKED by trigger
-- This ensures component identity stability (I1 immutable requirement)

-- Script 1: 3 components (draft status)
-- Plain text uses \n\n to separate paragraphs → components
SELECT save_script_with_components(
    '00000000-0000-0000-0000-000000000101'::uuid,  -- p_script_id
    NULL,  -- p_yjs_state (not needed for seed)
    E'Welcome to Alpha Video 1.\n\nThis is the first component. Each paragraph becomes a numbered component that flows through the production pipeline.\n\nThis is component three with more detail.',  -- p_plain_text
    '[
        {
            "component_number": 1,
            "content": "Welcome to Alpha Video 1.",
            "word_count": 5
        },
        {
            "component_number": 2,
            "content": "This is the first component. Each paragraph becomes a numbered component that flows through the production pipeline.",
            "word_count": 17
        },
        {
            "component_number": 3,
            "content": "This is component three with more detail.",
            "word_count": 7
        }
    ]'::jsonb  -- p_components
);

-- Link script to video (function creates script, now link video)
UPDATE public.scripts
SET video_id = '00000000-0000-0000-0000-000000000011',
    status = 'draft'
WHERE id = '00000000-0000-0000-0000-000000000101';

-- Script 2: 2 components (in_review status)
SELECT save_script_with_components(
    '00000000-0000-0000-0000-000000000102'::uuid,
    NULL,
    E'Alpha Video 2 script content.\n\nThis script is in review status and has two components for testing workflow states.',
    '[
        {
            "component_number": 1,
            "content": "Alpha Video 2 script content.",
            "word_count": 5
        },
        {
            "component_number": 2,
            "content": "This script is in review status and has two components for testing workflow states.",
            "word_count": 14
        }
    ]'::jsonb
);

UPDATE public.scripts
SET video_id = '00000000-0000-0000-0000-000000000012',
    status = 'in_review'
WHERE id = '00000000-0000-0000-0000-000000000102';

-- Script 3: 1 component (approved status)
SELECT save_script_with_components(
    '00000000-0000-0000-0000-000000000103'::uuid,
    NULL,
    'Beta Video 1 has an approved single-component script for testing approved workflow.',
    '[
        {
            "component_number": 1,
            "content": "Beta Video 1 has an approved single-component script for testing approved workflow.",
            "word_count": 12
        }
    ]'::jsonb
);

UPDATE public.scripts
SET video_id = '00000000-0000-0000-0000-000000000021',
    status = 'approved'
WHERE id = '00000000-0000-0000-0000-000000000103';

-- ============================================================================
-- IMPORTANT: TABLES NOT SEEDED HERE (Created by Auth Admin API or test setup)
-- ============================================================================
--
-- NOT SEEDED (Auth dependency):
-- - user_profiles: Created via Auth Admin API (auth.users → user_profiles)
-- - user_clients: Created in test setup AFTER users exist
-- - comments: Created in test setup or individual tests
-- - script_locks: Created by app logic during edit lock tests
--
-- SECURITY: Never seed auth.users or user_profiles with real data
-- PATTERN: Test users created via Auth Admin API in test setup
--
-- See: scripts/create-test-users-via-api.mjs (CI/scripts)
-- See: tests/setup/create-test-users.ts (test integration)
--
-- User creation happens:
-- - Local: Run scripts/create-test-users-via-api.mjs manually
-- - CI: Automated in .github/workflows/ci.yml
-- - Tests: beforeAll/beforeEach via tests/setup/create-test-users.ts
--
-- Post-user creation in tests:
-- - Insert user_clients to grant client access
-- - Insert comments to test commenting system
-- - Insert script_locks to test edit locking
-- ============================================================================

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Expected baseline counts (without auth-dependent tables):
-- - projects: 2
-- - videos: 3
-- - scripts: 3 (created via save_script_with_components function)
-- - script_components: 6 (3+2+1, created atomically with scripts)
-- - user_profiles: 0 (created by Auth Admin API)
-- - user_clients: 0 (created in test setup)
-- - comments: 0 (created by tests as needed)
-- - script_locks: 0 (created by app logic)

SELECT
    'Baseline seed complete (via production function)' as status,
    (SELECT COUNT(*) FROM public.projects) as projects,
    (SELECT COUNT(*) FROM public.videos) as videos,
    (SELECT COUNT(*) FROM public.scripts) as scripts,
    (SELECT COUNT(*) FROM public.script_components) as script_components,
    (SELECT COUNT(*) FROM public.user_profiles) as user_profiles,
    (SELECT COUNT(*) FROM public.user_clients) as user_clients,
    (SELECT COUNT(*) FROM public.comments) as comments,
    (SELECT COUNT(*) FROM public.script_locks) as script_locks;
