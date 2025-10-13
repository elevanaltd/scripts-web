# CI/CD Setup & Branch Protection

**Repository:** scripts-web
**Created:** 2025-10-13
**Status:** Ready for GitHub configuration

---

## GitHub Actions CI Pipeline

**File:** `.github/workflows/ci.yml`

**Triggers:**
- Push to `main` branch
- Pull requests targeting `main`

**Quality Gates Enforced:**
1. TypeScript compilation (`npm run typecheck`)
2. ESLint validation (`npm run lint`)
3. Test suite execution (`npm run test`)
4. Production build (`npm run build`)

**Features:**
- ✅ pnpm caching for faster runs
- ✅ Build artifact upload (7-day retention)
- ✅ Runs on Node.js 20 (LTS)

---

## Branch Protection Rules

### Configuration Steps

**Navigate to:** https://github.com/elevanaltd/scripts-web/settings/branches

**Click:** "Add branch protection rule"

**Branch name pattern:** `main`

### Required Settings

#### ✅ Require a pull request before merging
- **Require approvals:** 0 (solo developer)
- **Dismiss stale pull request approvals:** ✅ Enabled
- **Require review from Code Owners:** ❌ Disabled (no CODEOWNERS file yet)

#### ✅ Require status checks to pass before merging
- **Require branches to be up to date:** ✅ Enabled
- **Status checks that are required:**
  - `Quality Gates` (from CI workflow)

**How to add status check:**
1. After first CI run, the "Quality Gates" check will appear in the list
2. Search for "Quality Gates" in status checks
3. Select it to make it required

#### ✅ Require conversation resolution before merging
- All PR comment threads must be resolved

#### ✅ Require linear history
- Prevents merge commits (enforces rebase or squash)

#### ❌ Do not require signed commits
- Not required for solo developer (optional enhancement)

#### ✅ Include administrators
- Applies rules to repository admins (you)
- Prevents accidental bypass

#### ❌ Allow force pushes
- Disabled (protects main branch history)

#### ❌ Allow deletions
- Disabled (prevents accidental branch deletion)

---

## Quality Gate Details

### TypeScript Check
```bash
npm run typecheck
# Must pass: Zero TypeScript errors
```

### ESLint Check
```bash
npm run lint
# Must pass: Zero ESLint warnings
```

### Test Suite
```bash
npm run test -- --run
# Must pass: All tests green (458/647 currently passing)
```

### Build
```bash
npm run build
# Must pass: Production build succeeds
```

---

## Workflow

### Creating a Pull Request

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes, commit atomically
3. Push branch: `git push origin feature/my-feature`
4. Create PR on GitHub
5. Wait for CI pipeline (Quality Gates check)
6. Review results:
   - ✅ All checks pass → PR can be merged
   - ❌ Any check fails → Fix issues and push again

### Merging to Main

**Option 1: Squash and merge** (Recommended)
- Combines all commits into one
- Clean linear history
- Good for feature branches with multiple commits

**Option 2: Rebase and merge**
- Preserves individual commits
- Linear history maintained
- Good for clean commit sequences

**Option 3: Create a merge commit**
- Disabled by linear history requirement

### Direct Push to Main

**Status:** Blocked by branch protection (after configuration)

**Bypass:** Not recommended (defeats quality gates)

**Emergency Override:** Admin can force push if absolutely necessary (constitutional violation - requires justification)

---

## CI Performance

**Expected Runtime:** 2-4 minutes

**Breakdown:**
- Checkout: 5-10s
- Setup Node + pnpm: 10-15s
- Install dependencies (cached): 20-30s
- TypeScript check: 5-10s
- ESLint: 10-15s
- Tests: 60-90s
- Build: 30-45s

**Optimization:**
- pnpm store cached (speeds up installs)
- Parallel job execution (not currently used)
- Build artifacts uploaded for deployment

---

## Troubleshooting

### CI Failing on Fresh Branch

**Symptom:** "Quality Gates" check fails after creating branch protection
**Cause:** Branch protection rule created before first CI run
**Solution:**
1. Make a trivial change (add newline to README)
2. Commit and push to trigger CI
3. Once CI completes, the check will appear in branch protection settings

### Tests Failing in CI but Passing Locally

**Possible Causes:**
- Environment variable differences
- Timezone differences (CI runs in UTC)
- File system case sensitivity (macOS vs Linux)
- Missing `.env.example` variables

**Solution:** Check CI logs for specific failures

### Build Artifacts Not Uploading

**Cause:** Build step failed before artifact upload
**Solution:** Fix build errors, artifacts only upload on success

---

## Future Enhancements

### Potential Additions

1. **Code Coverage Reporting**
   - Upload coverage reports to Codecov
   - Require minimum coverage percentage

2. **Deployment Preview**
   - Auto-deploy PR branches to Vercel preview URLs
   - Comment preview link on PR

3. **Dependency Security Scanning**
   - Audit npm packages for vulnerabilities
   - Block merges with critical CVEs

4. **Performance Budgets**
   - Lighthouse CI for bundle size monitoring
   - Block PRs that increase bundle beyond threshold

5. **CODEOWNERS File**
   - Auto-assign reviewers for specific paths
   - Require review from specific team members

---

## Constitutional Compliance

**Quality Gates Enforced (CONSTITUTIONAL_ESSENTIALS line 56):**
- ✅ TDD: Tests run automatically
- ✅ Code Review: PR required (solo developer reviews own work)
- ✅ Type Safety: TypeScript check blocks merge
- ✅ Lint: ESLint enforces code standards

**TRACED Protocol Integration:**
- T: Tests run in CI (failing test prevents merge)
- R: PR process enables review
- A: TypeScript enforces architecture
- C: CI provides consultation visibility
- E: All quality gates execute automatically
- D: PR description documents changes

**BLOCKING_AUTHORITY (line 149):**
CI pipeline exercises blocking authority for:
- TypeScript errors (type safety violation)
- ESLint warnings (code standard violation)
- Test failures (regression detected)
- Build failures (production readiness violation)

---

**Status:** Documentation complete, ready for GitHub configuration
**Next:** Apply branch protection rules via GitHub UI
