# EAV Scripts Web - Development Instructions

<!-- MULTI_REPO: Clean independent repository for Scripts app (1 of 7) -->
<!-- STATUS: Migrated from production monolith ✅ | Multi-app suite architecture -->

**Project:** EAV Scripts Web (App 1 of 7)
**Repository:** `/Volumes/HestAI-Projects/eav-apps/scripts-web/` (🟢 **CLEAN MULTI-REPO**)
**Remote:** `https://github.com/elevanaltd/scripts-web`
**Purpose:** Collaborative script editor with realtime Y.js collaboration and SmartSuite integration
**Last Updated:** 2025-10-13 (Multi-Repo Migration)
**Status:** Migrated - 138 files, 28 Supabase migrations, 454/611 tests passing

## Current State Overview

### ✅ ARCHITECTURE PROVEN & OPERATIONAL
The paragraph=component model has been **successfully validated and is now in production use**:
- **TipTap Editor:** Single editor with component extraction working perfectly
- **Component Identity:** C1, C2, C3... stable throughout entire system lifecycle
- **Supabase Backend:** Scripts and components persisting with atomic saves
- **Authentication:** User management and secure access operational
- **SmartSuite Integration:** Project/video hierarchy loading from production workspace
- **Auto-Save:** Visual status indicators and reliable persistence
- **TDD Compliance:** 653 tests total (505 passing, 9 failing, 139 skipped) - failures in CommentSidebar cache + BroadcastChannel polyfill, fixes scheduled during B1_03
- **Bundle Optimization:** 865KB optimized with vendor chunking
- **React Lifecycle:** All warnings resolved, clean console output
- **Security Score:** Database hardened to 9/10 (Supabase linter 0E/0W) - front-end security score requires revalidation

### 🚀 CURRENT FOCUS
**Security Crisis Resolved (2025-10-07)** - 5 critical issues fixed in PR#56:
1. ✅ NULL role bypass (CATASTROPHIC) - Fixed authorization check
2. ✅ Client save trigger → 403 error - Added permission guard
3. ✅ Client comment deletion blocked - Simplified RLS policy
4. ✅ Editor editability not reactive - Added useEffect for permissions
5. ✅ Test mock interface mismatch - Aligned with AuthContext

**Production Status:** Migrations applied via Supabase MCP. Ready for PR merge and client testing.

## Production Requirements (From North Star)

### Core Problem Being Solved
**EAV's video production workflow requires component-based script editing where each paragraph becomes a trackable production component (C1, C2, C3...) flowing seamlessly through Script → Review → Scenes → Voice → Edit phases with collaborative commenting throughout.**

### Immutable Production Requirements
1. **Paragraph=Component Model** - Every paragraph typed becomes a numbered component
2. **Single Editor Interface** - ONE TipTap editor (not component-by-component)
3. **Component Persistence** - Stable IDs throughout system lifecycle
4. **SmartSuite Integration** - Components sync to video production tables
5. **Collaborative Review** - Google Docs-like commenting for client review and edit direction
6. **Offline Capability** - Camera operators must work without internet connection

## Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript (strict mode)
- **Build:** Vite for fast HMR and optimal bundles
- **Editor:** TipTap with custom component extensions
- **State:** React hooks with context for global state
- **Styling:** CSS3 with responsive design

### Backend
- **Database:** Supabase (PostgreSQL with RLS)
- **Auth:** Supabase Auth with email/password
- **Storage:** PostgreSQL for scripts and components
- **API:** Supabase client SDK with real-time subscriptions

### Integration
- **SmartSuite:** Workspace s3qnmox1 (Projects: 68a8ff5237fde0bf797c05b3, Videos: 68b2437a8f1755b055e0a124)
- **ElevenLabs:** Voice generation API (Phase 6)

### Testing
- **Framework:** Vitest with Testing Library
- **Current Status:** 653 tests total (505 passing, 9 failing, 139 skipped)
- **Known Failures:** CommentSidebar cache cleanup (missing `clear()` hook) + BroadcastChannel polyfill (Node compatibility) - fixes scheduled during B1_03
- **Focus:** Constitutional TDD compliance with characterization tests
- **Coverage:** Comprehensive test suite covering all critical paths

## File Structure

```
dev/                                 # Active production build
├── src/
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── TipTapEditor.tsx   # ✅ Core editor with component extraction
│   │   │   └── EditorToolbar.tsx  # ✅ Formatting controls
│   │   ├── Layout/
│   │   │   ├── Navigation.tsx     # ✅ Project/video selection
│   │   │   └── TabLayout.tsx      # 🚧 Script/Review/Scenes/Voice/Edit tabs
│   │   └── SmartSuite/
│   │       └── SyncPanel.tsx      # 🚧 Component sync interface
│   ├── lib/
│   │   ├── supabase.ts            # ✅ Database client and auth
│   │   ├── smartsuite.ts          # 🚧 API integration (switching to live)
│   │   └── components.ts          # ✅ Component extraction logic
│   ├── hooks/
│   │   ├── useAutoSave.ts         # ✅ Debounced save with status
│   │   └── useProjects.ts         # ✅ Project/video data fetching
│   ├── types/
│   │   └── index.ts               # ✅ TypeScript definitions
│   └── App.tsx                    # ✅ Main application shell
├── supabase/
│   └── migrations/                # ✅ Database schema (5 tables)
├── .env.example                   # ✅ Environment template
└── CLAUDE.md                      # 📍 This file
```

## Environment Configuration

```bash
# Supabase (Production)
# NOTE: Supabase has migrated from anon/service_role to publishable/secret keys
VITE_SUPABASE_URL=https://zbxvjyrbkycbfhwmmnmy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[your_publishable_key]  # Client-side (successor to anon_key)
SUPABASE_SECRET_KEY=[your_secret_key]                  # Server-side only for webhooks (successor to service_role)

# SmartSuite (Production Workspace)
VITE_SMARTSUITE_API_KEY=[your_api_key]
VITE_SMARTSUITE_WORKSPACE_ID=s3qnmox1
VITE_SMARTSUITE_PROJECTS_TABLE=68a8ff5237fde0bf797c05b3
VITE_SMARTSUITE_VIDEOS_TABLE=68b2437a8f1755b055e0a124
SMARTSUITE_WEBHOOK_SECRET=[your_webhook_secret]        # For webhook signature verification

# ElevenLabs (Future)
VITE_ELEVENLABS_API_KEY=[future_implementation]
```

## Development Commands

```bash
# Initial Setup
npm install                    # Install dependencies
cp .env.example .env          # Configure environment
npm run supabase:types        # Generate TypeScript types

# Development
npm run dev                   # Start dev server (http://localhost:5173)
npm run test                  # Run test suite
npm run test:watch           # Watch mode for TDD

# Quality Gates
npm run typecheck            # TypeScript validation
npm run lint                 # ESLint checks
npm run lint:fix            # Auto-fix issues
npm run validate            # All checks (must pass before commit)

# Build
npm run build               # Production build
npm run preview            # Preview production build
```

## Database Migration Best Practices

### ✅ PREFERRED: Supabase MCP Tools (Recommended)
Use Supabase MCP tools for direct production database access:

```typescript
// For DDL operations (CREATE, ALTER, DROP)
mcp__supabase__apply_migration({
  project_id: "zbxvjyrbkycbfhwmmnmy",
  name: "descriptive_migration_name",
  query: "CREATE TABLE ... or ALTER TABLE ..."
})

// For DML operations or complex queries
mcp__supabase__execute_sql({
  project_id: "zbxvjyrbkycbfhwmmnmy",
  query: "INSERT INTO ... or UPDATE ... or DROP POLICY ..."
})
```

**Advantages:**
- ✅ Direct production access (no connection string issues)
- ✅ Automatic authentication via MCP server
- ✅ Works reliably across all environments
- ✅ Tracks migrations in Supabase schema_migrations table

### ❌ AVOID: Supabase CLI `db push`
The CLI often fails with connection errors:
```bash
# This frequently fails with "Tenant or user not found"
npx supabase db push --db-url "..."  # ❌ Unreliable
```

### Migration Workflow
1. Create migration file in `supabase/migrations/`
2. Test locally with Supabase Docker (if needed)
3. Apply to production via MCP tools
4. Verify with `list_migrations` or Dashboard
5. Commit migration file to git

## Implementation Roadmap

### ✅ Completed
- Core paragraph=component architecture
- TipTap editor with component extraction
- Supabase integration with auth
- Project/video navigation
- Auto-save functionality
- Component identity preservation
- **TDD Constitutional Compliance** - 653 tests (505 passing, 9 failing, 139 skipped)
- **Bundle Optimization** - 865KB with vendor chunking
- **React Lifecycle Fixes** - All warnings resolved
- **Security Hardening** - Database 9/10 (Supabase linter 0E/0W)

### ✅ Current Phase (1): SmartSuite Webhook Integration
- [x] Frontend reads from Supabase only (single source of truth)
- [x] Webhook endpoint receives SmartSuite changes
- [x] Real-time sync via SmartSuite automations
- [x] Manual sync button as fallback option
- [x] Configure SmartSuite webhook automations

### 📋 Upcoming Phases
2. **Workflow Implementation** (5-6 days) - Core workflow tabs (reduced scope)
3. **Collaborative Comments** (4-5 days) - Essential commenting system
4. **Voice Generation** (2 days) - ElevenLabs integration
5. **Final Quality Assurance** (2 days) - Production validation
6. **Deployment Prep** (2 days) - Documentation and handoff

**Total Timeline:** 15-20 days to production readiness (significantly reduced due to excellent foundation)

## Architecture Principles

### ✅ Validated Patterns (Keep Using)
1. **Single TipTap Editor** - Unified editing experience
2. **Server-Side Extraction** - Components extracted by database
3. **Atomic Saves** - All-or-nothing persistence
4. **Direct Error Reporting** - Immediate visibility during development
5. **Component ID Stability** - C1 remains C1 forever

### ❌ Anti-Patterns (Never Implement)
1. **Component-by-Component UI** - Creates state management hell
2. **Multiple Sources of Truth** - Causes synchronization issues
3. **Circuit Breaker Masking** - Hides real problems
4. **Client-Side Extraction** - Unreliable and complex
5. **Silent Failures** - Always validate and report

## Quality Standards

### Every Commit Must
- ✅ Pass TypeScript compilation (zero errors)
- ✅ Pass ESLint checks (zero warnings)
- ✅ Pass all existing tests (653 tests - 9 known failures addressed in B1_03)
- ✅ Maintain TDD constitutional compliance
- ✅ Include clear commit message
- ✅ Maintain component ID stability
- ✅ Include characterization tests for new features

### Before Phase Completion
- ✅ All acceptance criteria met
- ✅ User-facing features tested manually
- ✅ Performance acceptable (<50ms typing latency)
- ✅ No console errors or warnings
- ✅ Documentation updated

## Current Development Priorities

### Immediate (Next)
1. Begin Phase 2 workflow implementation
2. Implement core workflow tabs with TDD approach
3. Address 9 test failures in CommentSidebar + BroadcastChannel during B1_03

### This Week
1. Complete Phase 2 (Workflow Implementation)
2. Begin Phase 3 (Collaborative Comments)
3. Maintain production-ready standards throughout

### Decision Points
- After Phase 1: Is SmartSuite integration sustainable?
- After Phase 3: Is collaboration pattern working?
- After Phase 7: Ready for production deployment?

## Known Issues & Workarounds

### Current Issues
- **Auto-refresh race condition** - Multiple project fetches on mount (minor)
- **Test failures (9 total)** - CommentSidebar cache cleanup missing `clear()` hook + BroadcastChannel polyfill Node compatibility (1,772 errors) - fixes scheduled during B1_03, non-blocking for production use

### ✅ Optimized Performance (2025-09-28)
- **Bundle size optimized** - 865KB total with efficient vendor chunking:
  - vendor-react: 314KB (React/ReactDOM)
  - vendor-editor: 303KB (TipTap editor components)
  - vendor-supabase: 124KB (Supabase client)
  - vendor-utils: 73KB (Zod, DOMPurify, Y.js)
  - vendor-router: 32KB (React Router)
  - Main app: 49KB (application code)

### Resolved Issues (2025-10-07 - Security Crisis)
- ✅ **NULL Role Bypass (CATASTROPHIC)** - Fixed authorization check in save_script_with_components
- ✅ **Client Save Trigger** - Added permission guard to prevent 403 errors
- ✅ **Client Comment Deletion** - Simplified RLS policy for ownership-based deletion
- ✅ **Editor Editability** - Made reactive to permission changes
- ✅ **Test Mocks** - Aligned interface property names (loading, display_name)

### Resolved Issues (2025-10-07 - Phase 2.9)
- ✅ **Database Hardening Complete** - Zero Supabase linter errors/warnings
- ✅ **RLS Performance Optimization** - InitPlan pattern reduces 50-100ms at scale
- ✅ **Policy Consolidation** - 50% reduction in policy evaluation overhead
- ✅ **Security Hardening** - All SECURITY DEFINER functions protected with search_path
- ✅ **Ambiguous Column References** - Fixed in save_script_with_components and get_comment_descendants
- ✅ **Refresh Function Security** - Added search_path protection to refresh_user_accessible_scripts

### Resolved Issues (2025-09-28)
- ✅ **TDD Constitutional Compliance** - 653 tests implemented, characterization tests added (9 failures in cache/polyfill pending B1_03)
- ✅ **Bundle Size Crisis** - Optimized to 865KB with vendor chunking
- ✅ **React Lifecycle Issues** - All warnings resolved, clean console output
- ✅ **Security Vulnerabilities** - Hardened to 9/10 security score
- ✅ **406 Error on Scripts** - Fixed by using `.maybeSingle()` instead of `.single()`
- ✅ **RLS Policies** - Migration 20250927130000 properly handles admin/client access
- ✅ **NavigationSidebar warnings** - Improved error handling for missing eav_code
- ✅ **Edge Functions crash** - Switched to client-side
- ✅ **ESLint suppressions** - Cleaned up with reset
- ✅ **RLS policies blocking saves** - Fixed permissions

## Important Database Query Patterns

### Avoiding 406 Errors
When querying for records that might not exist:
```typescript
// ❌ WRONG - Will throw 406 if no rows found
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', someId)
  .single();  // Expects exactly 1 row

// ✅ CORRECT - Handles 0 or 1 rows gracefully
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', someId)
  .maybeSingle();  // Returns null if no rows, data if 1 row
```

### RLS Policy Structure
The current RLS policies follow this pattern:
- **Admin users**: Full access (SELECT, INSERT, UPDATE, DELETE) on all tables
- **Client users**: Read-only (SELECT) on projects/videos/scripts they're assigned to via `user_clients` table
- **Anonymous users**: No access to any data

Always test with both service key (bypasses RLS) and anon key (enforces RLS) when debugging access issues.

## Team Notes

**User Feedback:** *"Working really well. Better than I could have thought."* - After initial demo

**Architecture Status:** Core model proven successful. The paragraph=component approach works intuitively and maintains stability throughout the workflow.

**TDD Status:** 653 tests total (505 passing, 9 failing, 139 skipped). Known failures in CommentSidebar cache + BroadcastChannel polyfill - fixes parallel to B1_03, quality gate enforced at B2.

**Performance Status:** Bundle optimized to 865KB, React lifecycle issues resolved, database security hardened to 9/10 (Supabase linter 0E/0W).

**Next Milestone:** Begin Phase 2 workflow implementation with maintained TDD discipline and production standards.

---

## Multi-Repo Architecture Notes

**Migration Context (2025-10-13):**
This app was migrated from the production monolith (`eav-orchestrator-mvp`) to a clean multi-repo structure. It is one of 7 independent apps in the EAV suite, each with its own git repository and independent deployment.

**Key Changes:**
- Independent git repository at https://github.com/elevanaltd/scripts-web
- Database coupling via Supabase (not code dependencies between apps)
- .coord symlink points to `../coordination/apps/scripts-web/`
- No shared code packages needed (self-contained app)

**Other Apps in Suite (6 remaining):**
2. Storyboards Web
3. Scenes Web
4. Voice Web
5. Edit Web
6. Operations Web (dashboard/client portal)
7. API Server (webhooks, background jobs)

**Coordination:**
- App-specific planning: `.coord/` (symlink to `../coordination/apps/scripts-web/`)
- Suite-wide coordination: `.coord/../../` (master PROJECT-CONTEXT.md, ARCHITECTURE.md)
- Database schema: `.coord/../../docs/001-DOC-DATABASE-SCHEMA.md`

---

**Key Principle:** This is a PRODUCTION BUILD. Every line of code, every architectural decision, and every feature must meet production standards. We've proven the architecture works - now we're building the complete system with zero technical debt.

---

*For app-specific planning see: `.coord/APP-CONTEXT.md`, `.coord/APP-ROADMAP.md`, `.coord/APP-CHECKLIST.md`*
*For suite-wide context see: `.coord/../../PROJECT-CONTEXT.md`, `.coord/../../ARCHITECTURE.md`*