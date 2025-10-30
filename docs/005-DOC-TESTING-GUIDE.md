# Testing Guide - Scripts Web

## Prerequisites

- **Docker Desktop** - Required for local Supabase instance
- **Supabase CLI** - Install via `npm install -g supabase`

## Starting Local Supabase

```bash
# Start Docker containers (runs on 127.0.0.1:54321)
supabase start

# Verify running
supabase status
```

## Running Tests

### Unit Tests (fast, no Supabase required)
```bash
npm run test:unit
```

### Integration Tests (requires Docker Supabase running)
```bash
npm run test:integration
```

### All Tests
```bash
npm test
```

## Environment-Aware Test Configuration

The test suite uses **environment-aware fallback logic** for seamless local and CI execution:

- **Local Development:** Automatically uses Docker Supabase at `127.0.0.1:54321`
- **CI Environment:** Automatically uses Supabase preview branch (isolated per PR)
- **Configuration:** Copy `.env.local.example` to `.env.local` for explicit local config (optional)

### Smart Fallback Logic

The test infrastructure (`src/test/supabase-test-client.ts`) automatically detects the environment:

1. **CI Detection:** If `SUPABASE_PREVIEW_URL` is set → use preview branch
2. **Local Detection:** If running in Node.js → use `127.0.0.1:54321`
3. **Fallback:** Use environment variables from `.env` or `.env.local`

**Important:** Never hardcode Supabase URLs in package.json scripts. Trust the smart fallback.

### Fail-Fast Guard

The test infrastructure includes validation to catch environment misconfigurations immediately:

```typescript
// Detects if CI preview branch connection is blocked by hardcoded overrides
if (process.env.SUPABASE_PREVIEW_URL && SUPABASE_URL.includes('127.0.0.1')) {
  throw new Error('CI MISCONFIGURATION: Environment override preventing preview connection')
}
```

This prevents silent regressions where package.json overrides cause 50+ minute CI hangs.

## Test Users

Integration tests use standardized test users created via `tests/setup/create-test-users.ts`:

- `admin.test@example.com` - Admin role user
- `client.test@example.com` - Client role user
- `unauthorized.test@example.com` - User without role assignment

## Troubleshooting

### Integration tests hanging
- **Cause:** Docker Supabase not running
- **Fix:** Run `supabase start` and verify with `supabase status`

### Integration tests failing with connection errors
- **Cause:** Hardcoded URL override in package.json scripts
- **Fix:** Remove any `VITE_SUPABASE_URL` or `SUPABASE_URL` overrides from test scripts
- **Verify:** Test scripts should only set `VITEST_INTEGRATION=true`

### CI tests hanging 50+ minutes
- **Cause:** Environment override blocking preview branch connection
- **Fix:** The fail-fast guard will catch this immediately with clear error message
- **Prevention:** Never hardcode Supabase URLs in package.json

## Architecture

### Two-Tier Testing Strategy

1. **Unit Tests:** Mock Supabase client with fake credentials for isolation
2. **Integration Tests:** Real Supabase client connecting to local instance or preview branch

### Constitutional Basis

- **TDD Exemption:** Test infrastructure files (`src/test/*.ts`) are validated through dependent test execution, not co-located tests (prevents meta-testing paradox)
- **Minimal Intervention:** Only mock when isolation is needed
- **Quality Gate Enforcement:** All tests must pass before commit

## References

- Suite Testing Standards: `/Volumes/HestAI-Projects/eav-ops/CLAUDE.md`
- Universal TDD Discipline: `/Users/shaunbuswell/.claude/CLAUDE.md`
- Test Infrastructure: `src/test/supabase-test-client.ts`, `src/test/setup.ts`
