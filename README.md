# Scripts Web App

**App:** 1 of 7 in EAV Apps Suite
**Status:** 🔄 Migration in Progress
**Production:** Deployed and being tested

---

## Overview

TipTap editor with Y.js realtime collaboration, comment system with position tracking, Supabase integration, and SmartSuite webhooks.

**Key Features:**
- Rich text editing with TipTap
- Real-time collaboration via Y.js
- Comment system with threading and position tracking
- Auto-save with visual status indicator
- Script status workflow (draft → review → approved)
- Component extraction (C1, C2, C3...)
- Supabase auth + RLS
- SmartSuite integration for project/video metadata

---

## Quick Links

**App Coordination:**
- [Current State](.coord/APP-CONTEXT.md)
- [Roadmap](.coord/APP-ROADMAP.md)
- [Active Tasks](.coord/APP-CHECKLIST.md)

**Suite Coordination:**
- [Master Context](.coord/../../PROJECT-CONTEXT.md)
- [Suite Roadmap](.coord/../../PROJECT-ROADMAP.md)
- [Architecture Decisions](.coord/../../ARCHITECTURE.md)

**Technical Docs:**
- [Database Schema](.coord/../../docs/001-DOC-DATABASE-SCHEMA.md)
- [Navigation Design](.coord/../../docs/002-DOC-UNIFIED-NAVIGATION.md)
- [Deployment Strategy](.coord/../../docs/003-DOC-DEPLOYMENT-STRATEGY.md)

---

## Local Development

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (REQUIRED)
cp .env.example .env
# Edit .env with your configuration
# See "Environment Configuration" section below

# 3. Verify configuration
./scripts/validate-env.sh
# ✓ Should pass before first commit

# 4. Run dev server
npm run dev
```

### Daily Workflow

```bash
# Run dev server
npm run dev

# Run tests
npm run test

# Run quality gates
npm run typecheck
npm run lint
npm run build

# Validate environment (manual)
./scripts/validate-env.sh
```

### Environment Configuration

**IMPORTANT**: This project uses **validated environment configuration** to prevent runtime errors.

**Configuration File**: `.env` (copy from `.env.example`)

**Automatic Validation**: Pre-commit hook validates `.env` before every commit
- ✓ Valid config → Commit allowed
- ✗ Invalid config → Commit blocked with clear error message

**Required Variables**:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_DEBUG_MODE=false  # optional
```

**Manual Validation**:
```bash
# Validate current .env
./scripts/validate-env.sh

# Validate specific file
./scripts/validate-env.sh .env.production
```

**Troubleshooting**:
```bash
# If commit is blocked:
✗ Environment validation failed
VITE_SUPABASE_URL: VITE_SUPABASE_URL must be a valid URL

# 1. Check your .env file
cat .env

# 2. Compare with .env.example
cat .env.example

# 3. Fix the invalid variable
vim .env

# 4. Retry commit
git commit -m "your message"
✓ Environment validation passed
```

**Architecture**: See [ADR-006](.coord/docs/005-DOC-ADR-006-ENVIRONMENT-CONFIGURATION-PREVENTION.md) for full details

---

## Project Structure

```
scripts-web/
├── .coord/              → Symlink to ../coordination/apps/scripts-web/
├── src/                 → Application source code
├── public/              → Static assets
├── tests/               → Test files
├── package.json         → Dependencies
├── vercel.json          → Deployment config
└── README.md            → This file
```

---

## Deployment

**Production:** `operations.eav.app/scripts`
**Staging:** `staging-scripts.eav.app`
**Development:** `dev-scripts.eav.app`

**Deploy Process:**
```bash
git push origin main       # Auto-deploys to production via Vercel
git push origin staging    # Auto-deploys to staging
git push origin development # Auto-deploys to development
```

---

## Status

**Current Phase:** Migration Complete (Oct 13, 2025)

**Migration Results:**
- ✅ 138 source files migrated from production
- ✅ 28 Supabase migrations preserved
- ✅ 454/611 tests passing (74% coverage)
- ✅ All quality gates validated
- ✅ Multi-repo structure established

**Next Steps:**
1. Set up Vercel deployment
2. Add unified navigation component
3. Verify all features working in production

See [APP-CHECKLIST.md](.coord/APP-CHECKLIST.md) for detailed tasks.

---

**Coordination:** See `.coord/` directory for app-specific planning docs
**Suite Docs:** See `.coord/../../` for suite-wide coordination
