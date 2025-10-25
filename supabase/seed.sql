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
-- PRODUCTION CONSTRAINTS:
--   - Direct writes to script_components blocked by trigger (component stability)
--   - save_script_with_components() requires edit lock (auth session)
--   - Seed context: Temporarily disable triggers for controlled baseline creation
-- ============================================================================

-- ============================================================================
-- DISABLE PRODUCTION CONSTRAINTS FOR SEEDING
-- ============================================================================
-- Temporarily disable triggers that enforce:
-- 1. Component write protection (requires save_script_with_components function)
-- 2. Edit lock requirement (requires auth session)
--
-- SAFE because:
-- - seed.sql runs ONCE in controlled context (local reset OR preview creation)
-- - We control the baseline data being inserted
-- - Triggers re-enabled immediately after seeding
-- - NEVER runs in production

ALTER TABLE script_components DISABLE TRIGGER protect_component_writes_insert;
ALTER TABLE script_components DISABLE TRIGGER protect_component_writes_update;
ALTER TABLE script_components DISABLE TRIGGER protect_component_writes_delete;

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
-- SCRIPTS + COMPONENTS (Direct INSERT while triggers disabled)
-- ============================================================================

-- Script 1: 3 components (draft status)
INSERT INTO public.scripts (id, video_id, plain_text, component_count, status, created_at, updated_at) VALUES
(
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    E'Welcome to Alpha Video 1.\n\nThis is the first component. Each paragraph becomes a numbered component that flows through the production pipeline.\n\nThis is component three with more detail.',
    3,
    'draft',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.script_components (id, script_id, component_number, content, word_count, created_at) VALUES
(
    '00000000-0000-0000-0000-000000001001',
    '00000000-0000-0000-0000-000000000101',
    1,
    'Welcome to Alpha Video 1.',
    5,
    NOW()
),
(
    '00000000-0000-0000-0000-000000001002',
    '00000000-0000-0000-0000-000000000101',
    2,
    'This is the first component. Each paragraph becomes a numbered component that flows through the production pipeline.',
    17,
    NOW()
),
(
    '00000000-0000-0000-0000-000000001003',
    '00000000-0000-0000-0000-000000000101',
    3,
    'This is component three with more detail.',
    7,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Script 2: 2 components (in_review status)
INSERT INTO public.scripts (id, video_id, plain_text, component_count, status, created_at, updated_at) VALUES
(
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000012',
    E'Alpha Video 2 script content.\n\nThis script is in review status and has two components for testing workflow states.',
    2,
    'in_review',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.script_components (id, script_id, component_number, content, word_count, created_at) VALUES
(
    '00000000-0000-0000-0000-000000001011',
    '00000000-0000-0000-0000-000000000102',
    1,
    'Alpha Video 2 script content.',
    5,
    NOW()
),
(
    '00000000-0000-0000-0000-000000001012',
    '00000000-0000-0000-0000-000000000102',
    2,
    'This script is in review status and has two components for testing workflow states.',
    14,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Script 3: 1 component (approved status)
INSERT INTO public.scripts (id, video_id, plain_text, component_count, status, created_at, updated_at) VALUES
(
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000021',
    'Beta Video 1 has an approved single-component script for testing approved workflow.',
    1,
    'approved',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.script_components (id, script_id, component_number, content, word_count, created_at) VALUES
(
    '00000000-0000-0000-0000-000000001021',
    '00000000-0000-0000-0000-000000000103',
    1,
    'Beta Video 1 has an approved single-component script for testing approved workflow.',
    12,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RE-ENABLE PRODUCTION CONSTRAINTS
-- ============================================================================
-- CRITICAL: Re-enable triggers to enforce production constraints
-- App will now require:
-- - save_script_with_components() for writes
-- - Edit locks before saving

ALTER TABLE script_components ENABLE TRIGGER protect_component_writes_insert;
ALTER TABLE script_components ENABLE TRIGGER protect_component_writes_update;
ALTER TABLE script_components ENABLE TRIGGER protect_component_writes_delete;

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
-- - Insert script_locks to test edit locking (via app functions)
-- ============================================================================

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Expected baseline counts (without auth-dependent tables):
-- - projects: 2
-- - videos: 3
-- - scripts: 3 (created with triggers disabled)
-- - script_components: 6 (3+2+1, created with triggers disabled)
-- - user_profiles: 0 (created by Auth Admin API)
-- - user_clients: 0 (created in test setup)
-- - comments: 0 (created by tests as needed)
-- - script_locks: 0 (created by app logic)
--
-- Triggers re-enabled: App now requires proper functions + locks

SELECT
    'Baseline seed complete (triggers re-enabled)' as status,
    (SELECT COUNT(*) FROM public.projects) as projects,
    (SELECT COUNT(*) FROM public.videos) as videos,
    (SELECT COUNT(*) FROM public.scripts) as scripts,
    (SELECT COUNT(*) FROM public.script_components) as script_components,
    (SELECT COUNT(*) FROM public.user_profiles) as user_profiles,
    (SELECT COUNT(*) FROM public.user_clients) as user_clients,
    (SELECT COUNT(*) FROM public.comments) as comments,
    (SELECT COUNT(*) FROM public.script_locks) as script_locks;
