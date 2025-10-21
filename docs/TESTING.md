# Testing Guide - scripts-web

**For:** Developers writing tests in scripts-web (and 6 other apps in EAV suite)
**Updated:** 2025-10-13
**Architecture:** React 18 + TypeScript + Vitest + React Query + Supabase

---

## Quick Start

### Running Tests

```bash
# Run all tests once
npm run test

# Watch mode (for TDD)
npm run test:watch

# With UI
npm run test:ui

# Run specific file
npm run test -- path/to/file.test.tsx

# Run with coverage
npm run test -- --coverage
```

### Writing Your First Test

```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../test/testUtils';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render successfully', () => {
    const { getByText } = renderWithProviders(<MyComponent />);
    expect(getByText('Hello')).toBeInTheDocument();
  });
});
```

**Key Difference from Standard React Testing:** Use `renderWithProviders` instead of `render` to automatically include QueryClient, AuthProvider, and routing.

---

## Architecture Overview

### Production Runtime Stack

```
QueryClientProvider (React Query)
  ↓
AuthProvider (Supabase Auth + User Profiles)
  ↓
NavigationProvider (Project/Video selection)
  ↓
ScriptStatusProvider (Script state management)
  ↓
BrowserRouter (React Router)
    ↓
  Your Component
```

**Testing Implication:** Components expect this context. Tests must provide it.

---

## Test Infrastructure

### Core Test Utilities

Located in: `/src/test/`

#### `testUtils.tsx` - Provider Wrappers

```typescript
import { renderWithProviders } from '../test/testUtils';

// Automatically wraps component with full provider stack
renderWithProviders(<MyComponent />, {
  mockAuth: {
    currentUser: { id: 'user-1', email: 'test@example.com' },
    userProfile: { role: 'admin', display_name: 'Test User' },
    loading: false
  }
});
```

**Available Functions:**
- `renderWithProviders(component, options)` - Render component with providers
- `renderHookWithProviders(hook, options)` - Test custom hooks
- `createTestQueryClient()` - Create isolated QueryClient for tests

#### `factories.ts` - Mock Data Creation

```typescript
import { createMockComment, createMockScript } from '../test/factories';

// Creates complete object with all required fields
const comment = createMockComment({
  content: 'Custom content',  // Override specific fields
  script_id: 'specific-id'
});

// Creates related object graph
const { script, parentComment, replies } = createMockCommentThread();
```

**Available Factories:**
- `createMockComment(overrides?)` - Complete comment object
- `createMockScript(overrides?)` - Complete script object
- `createMockVideo(overrides?)` - Complete video object
- `createMockProject(overrides?)` - Complete project object
- `createMockUser(overrides?)` - Complete user object
- `createMockCommentThread()` - Parent + replies graph

#### `setup.ts` - Global Test Configuration

Runs automatically before each test:
- Cleans up DOM after each test
- Clears all mocks
- Resets modules (prevents test pollution)
- Configures jsdom environment

---

## Testing Patterns

### Pattern 1: Unit Test (Component Logic)

**When to use:** Testing component rendering, event handlers, conditional display

**Template:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../test/testUtils';
import { ButtonComponent } from './ButtonComponent';

describe('ButtonComponent', () => {
  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();

    renderWithProviders(<ButtonComponent onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**Key Points:**
- Use `vi.fn()` for mock functions
- Use `screen.getByRole()` for accessible queries
- Use `renderWithProviders` for automatic context

---

### Pattern 2: Unit Test (Custom Hook)

**When to use:** Testing custom hooks that use React Query, Auth, or other contexts

**Template:**
```typescript
import { describe, it, expect } from 'vitest';
import { renderHookWithProviders, waitFor } from '../test/testUtils';
import { useMyHook } from './useMyHook';

describe('useMyHook', () => {
  it('should fetch and return data', async () => {
    const { result } = renderHookWithProviders(() => useMyHook('test-id'));

    // Wait for async operations
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
  });
});
```

**Key Points:**
- Use `renderHookWithProviders` for hooks using context
- Use `waitFor` for async state changes
- Access hook return value via `result.current`

---

### Pattern 3: Integration Test (with Auth)

**When to use:** Testing components that change behavior based on user role

**Template:**
```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../test/testUtils';
import { Editor } from './Editor';

describe('Editor - Role-based Access', () => {
  it('should show edit controls for admin users', () => {
    renderWithProviders(<Editor />, {
      mockAuth: {
        currentUser: { id: 'admin-1', email: 'admin@example.com' },
        userProfile: { role: 'admin', display_name: 'Admin User' },
        loading: false
      }
    });

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('should hide edit controls for client users', () => {
    renderWithProviders(<Editor />, {
      mockAuth: {
        currentUser: { id: 'client-1', email: 'client@example.com' },
        userProfile: { role: 'client', display_name: 'Client User' },
        loading: false
      }
    });

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });
});
```

**Key Points:**
- Pass `mockAuth` to control user role
- Test all role variations (admin, employee, client, unauthenticated)
- Use `queryBy*` for elements that shouldn't exist

---

### Pattern 4: Integration Test (with Database)

**When to use:** Testing actual database operations, RLS policies, foreign keys

**Setup Required:** Local Supabase instance (see Database Testing section)

**Template:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';
import { createMockScript, createMockComment } from '../test/factories';

describe('Comments Database Integration', () => {
  let testScript: ReturnType<typeof createMockScript>;

  beforeEach(async () => {
    // Seed required parent data
    testScript = createMockScript();
    await supabase.from('scripts').insert(testScript);
  });

  afterEach(async () => {
    // Cleanup (CASCADE will delete related comments)
    await supabase.from('scripts').delete().eq('id', testScript.id);
  });

  it('should enforce foreign key constraint on script_id', async () => {
    const invalidComment = createMockComment({
      script_id: 'non-existent-id'  // Invalid FK
    });

    const { error } = await supabase
      .from('comments')
      .insert(invalidComment);

    expect(error).toBeDefined();
    expect(error?.message).toContain('foreign key');
  });

  it('should create comment with valid script_id', async () => {
    const validComment = createMockComment({
      script_id: testScript.id  // Valid FK
    });

    const { data, error } = await supabase
      .from('comments')
      .insert(validComment)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.script_id).toBe(testScript.id);
  });
});
```

**Key Points:**
- Always seed parent data (respect FK constraints)
- Always cleanup in `afterEach` (prevent test pollution)
- Test both success and error paths
- Use real Supabase client (not mocked)

---

### Pattern 5: Characterization Test (Existing Code)

**When to use:** Adding tests to legacy code to preserve current behavior

**Template:**
```typescript
import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../test/testUtils';
import { LegacyComponent } from './LegacyComponent';
import { createMockComment } from '../test/factories';

describe('LegacyComponent - Characterization', () => {
  it('should display comment count badge when comments exist', () => {
    const comments = [
      createMockComment(),
      createMockComment(),
      createMockComment()
    ];

    renderWithProviders(<LegacyComponent comments={comments} />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText(/comments/i)).toBeInTheDocument();
  });

  it('should hide badge when no comments', () => {
    renderWithProviders(<LegacyComponent comments={[]} />);

    expect(screen.queryByLabelText(/comments/i)).not.toBeInTheDocument();
  });
});
```

**Key Points:**
- Describe current behavior (even if suboptimal)
- Don't refactor while characterizing
- Tests act as safety net for future changes
- Use factories to create realistic test data

---

## Mocking Strategies

### Strategy A: Mock useAuth Hook (Most Common)

**When to use:**
- Unit testing components that consume auth
- Testing permission-based UI logic
- NOT testing auth flows themselves

**How:**
```typescript
import { vi } from 'vitest';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// In test
mockUseAuth.mockReturnValue({
  currentUser: { id: 'user-1', email: 'test@example.com' },
  userProfile: { role: 'admin', display_name: 'Test User' },
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn()
});
```

**Alternative (using testUtils):**
```typescript
// Simpler - use built-in mockAuth
renderWithProviders(<Component />, {
  mockAuth: {
    currentUser: { id: 'user-1' },
    userProfile: { role: 'admin' },
    loading: false
  }
});
```

---

### Strategy B: Mock Supabase Client (Unit Tests)

**When to use:**
- Unit testing components that fetch data
- Testing loading/error states
- NOT testing actual database operations

**How:**
```typescript
import { vi } from 'vitest';
import * as supabaseModule from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: '123', title: 'Test' },
        error: null
      })
    }))
  }
}));
```

**Testing Error States:**
```typescript
// Override for error scenario
vi.mocked(supabase.from).mockReturnValue({
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'Not found' }
  })
} as any);

// Test that component handles error
renderWithProviders(<Component />);
await waitFor(() => {
  expect(screen.getByText(/error/i)).toBeInTheDocument();
});
```

---

### Strategy C: Real Supabase Client (Integration Tests)

**When to use:**
- Testing RLS policies
- Testing foreign key constraints
- Testing complex queries
- End-to-end feature tests

**Setup:**
1. Start local Supabase: `npx supabase start`
2. Seed test data in `beforeEach`
3. Cleanup in `afterEach`

**Example:** See Pattern 4 (Integration Test with Database) above

---

## Database Testing

### Local Supabase Setup

**1. Install Supabase CLI:**
```bash
npm install -g supabase
```

**2. Initialize Supabase:**
```bash
npx supabase init
```

**3. Start Local Instance:**
```bash
npx supabase start
```

This creates local services:
- PostgreSQL: `postgresql://postgres:postgres@localhost:54322/postgres`
- Studio: `http://localhost:54323`
- API: `http://localhost:54321`

**4. Link to Production Schema:**
```bash
npx supabase db pull
```

This downloads production migrations to `supabase/migrations/`

**5. Update vite.config.ts:**
```typescript
test: {
  env: {
    VITE_SUPABASE_URL: process.env.CI
      ? 'https://zbxvjyrbkycbfhwmmnmy.supabase.co'  // Production in CI
      : 'http://localhost:54321',                    // Local in dev
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.CI
      ? 'eyJhbGc...'  // Production key
      : 'eyJhbGc...'  // Local key (from supabase start output)
  }
}
```

### Database Seeding Strategy

**Option A: Per-Test Seeding (Recommended)**
```typescript
describe('Feature Tests', () => {
  let testProject: Project;
  let testVideo: Video;
  let testScript: Script;

  beforeEach(async () => {
    // Seed in FK order: projects → videos → scripts → comments
    const { data: project } = await supabase
      .from('projects')
      .insert(createMockProject())
      .select()
      .single();
    testProject = project;

    const { data: video } = await supabase
      .from('videos')
      .insert(createMockVideo({ eav_code: project.eav_code }))
      .select()
      .single();
    testVideo = video;

    const { data: script } = await supabase
      .from('scripts')
      .insert(createMockScript({ video_id: video.id }))
      .select()
      .single();
    testScript = script;
  });

  afterEach(async () => {
    // Cleanup in reverse FK order (or rely on CASCADE)
    await supabase.from('projects').delete().eq('id', testProject.id);
  });

  it('should create comment linked to script', async () => {
    const comment = createMockComment({ script_id: testScript.id });

    const { data, error } = await supabase
      .from('comments')
      .insert(comment)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.script_id).toBe(testScript.id);
  });
});
```

**Option B: Shared Test Fixtures (Fast, but coupling risk)**
```typescript
// supabase/fixtures/seed-test-data.sql
INSERT INTO projects (eav_code, client_filter, title) VALUES
  ('TEST001', 'test-client', 'Test Project 1'),
  ('TEST002', 'test-client', 'Test Project 2');

INSERT INTO videos (eav_code, title) VALUES
  ('TEST001', 'Test Video 1'),
  ('TEST002', 'Test Video 2');

-- etc...

-- Run once before all tests
// vitest.setup.ts
beforeAll(async () => {
  await supabase.from('projects').delete().like('eav_code', 'TEST%');
  await seedTestFixtures();
});
```

**Recommendation:** Use Option A (per-test seeding) for isolation. Use Option B only for read-only fixtures.

---

## TDD Workflow (Constitutional Requirement)

### Red-Green-Refactor Cycle

**1. RED: Write Failing Test**
```typescript
describe('CommentForm', () => {
  it('should submit comment with valid content', () => {
    const handleSubmit = vi.fn();

    renderWithProviders(<CommentForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Test comment' }
    });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(handleSubmit).toHaveBeenCalledWith('Test comment');
  });
});

// Run test: npm run test:watch
// Expected: ❌ FAIL - CommentForm doesn't exist yet
```

**2. GREEN: Write Minimal Implementation**
```typescript
export function CommentForm({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = React.useState('');

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSubmit(text);
    }}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit">Submit</button>
    </form>
  );
}

// Run test: npm run test:watch
// Expected: ✅ PASS
```

**3. REFACTOR: Improve Without Breaking Test**
```typescript
export function CommentForm({ onSubmit }: Props) {
  const [text, setText] = React.useState('');

  // Add validation (test still passes)
  const isValid = text.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(text);
    setText('');  // Clear after submit
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Comment text"
      />
      <button type="submit" disabled={!isValid}>
        Submit
      </button>
    </form>
  );
}

// Run test: npm run test:watch
// Expected: ✅ PASS (refactor didn't break behavior)
```

**4. ADD: Test New Behavior (repeat cycle)**
```typescript
it('should disable submit button when text is empty', () => {
  renderWithProviders(<CommentForm onSubmit={vi.fn()} />);

  const button = screen.getByRole('button', { name: /submit/i });
  expect(button).toBeDisabled();

  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Text' }
  });
  expect(button).not.toBeDisabled();
});
```

---

## Common Gotchas

### Issue 1: "No QueryClient set" Error

**Problem:**
```typescript
// ❌ Using standard render
import { render } from '@testing-library/react';
render(<MyComponent />);  // Error: No QueryClient set
```

**Solution:**
```typescript
// ✅ Use renderWithProviders
import { renderWithProviders } from '../test/testUtils';
renderWithProviders(<MyComponent />);
```

---

### Issue 2: "useAuth must be used within AuthProvider" Error

**Problem:**
```typescript
// Component uses useAuth
const { currentUser } = useAuth();

// Test doesn't provide AuthProvider
render(<MyComponent />);  // Error: useAuth must be used within AuthProvider
```

**Solution Option A (Mock useAuth):**
```typescript
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({
    currentUser: { id: 'user-1' },
    userProfile: { role: 'admin' },
    loading: false
  })
}));

render(<MyComponent />);  // ✅ Works
```

**Solution Option B (Use mockAuth):**
```typescript
renderWithProviders(<MyComponent />, {
  mockAuth: {
    currentUser: { id: 'user-1' },
    userProfile: { role: 'admin' }
  }
});  // ✅ Works
```

---

### Issue 3: Foreign Key Constraint Violations

**Problem:**
```typescript
const comment = createMockComment();
await supabase.from('comments').insert(comment);
// Error: violates foreign key constraint "comments_script_id_fkey"
```

**Solution:**
```typescript
// Seed parent data first
const script = createMockScript();
await supabase.from('scripts').insert(script);

// Then create comment referencing it
const comment = createMockComment({ script_id: script.id });
await supabase.from('comments').insert(comment);  // ✅ Works
```

---

### Issue 4: Tests Pollute Each Other

**Problem:**
```typescript
test('A', async () => {
  await supabase.from('comments').insert(createMockComment());
  // ... test passes
});

test('B', async () => {
  const { data } = await supabase.from('comments').select();
  expect(data).toHaveLength(0);  // ❌ FAILS - comment from test A still exists
});
```

**Solution:**
```typescript
afterEach(async () => {
  // Clean up ALL test data
  await supabase.from('comments').delete().like('id', '%');
  // Or use more specific cleanup based on test data
});
```

---

### Issue 5: Async State Not Awaited

**Problem:**
```typescript
it('should load data', () => {
  renderWithProviders(<AsyncComponent />);
  expect(screen.getByText('Data loaded')).toBeInTheDocument();  // ❌ FAILS - renders "Loading..." initially
});
```

**Solution:**
```typescript
it('should load data', async () => {
  renderWithProviders(<AsyncComponent />);

  // Wait for async state update
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });  // ✅ Works
});
```

---

## Test Organization

### File Structure

```
src/
├── components/
│   ├── CommentSidebar.tsx
│   ├── CommentSidebar.test.tsx          # Basic tests
│   ├── CommentSidebar.realtime.test.tsx # Realtime-specific tests
│   └── CommentSidebar.cache.test.tsx    # Cache behavior tests
├── hooks/
│   ├── usePermissions.ts
│   └── usePermissions.test.ts
└── lib/
    ├── comments.ts
    └── comments.test.ts                 # Integration tests
```

**Convention:**
- Colocate tests with source files
- Use `.test.ts` or `.test.tsx` extension
- Split large test suites into separate files (`.realtime.test.tsx`, `.cache.test.tsx`)

---

### Test File Template

```typescript
/**
 * ComponentName Tests
 *
 * Test Strategy: [Unit/Integration/E2E]
 * Scope: [What this file tests]
 * Dependencies: [External systems required]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../test/testUtils';
import { ComponentName } from './ComponentName';

// Mocks (if needed)
vi.mock('../lib/supabase', () => ({
  supabase: {
    // Mock implementation
  }
}));

describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Cleanup
  afterEach(() => {
    // Test-specific cleanup
  });

  describe('Feature 1', () => {
    it('should do X when Y happens', () => {
      // Arrange
      const props = { /* test props */ };

      // Act
      renderWithProviders(<ComponentName {...props} />);

      // Assert
      expect(screen.getByText('Expected')).toBeInTheDocument();
    });
  });

  describe('Feature 2', () => {
    it('should do Z when W happens', async () => {
      // Test async behavior
      renderWithProviders(<ComponentName />);

      await waitFor(() => {
        expect(screen.getByText('Loaded')).toBeInTheDocument();
      });
    });
  });
});
```

---

## Coverage Guidelines

### Target: 90% Coverage (Constitutional Requirement)

**Priority Coverage Areas:**
1. **Critical Path** (100% required)
   - Auth flows
   - Data persistence (saves, updates, deletes)
   - Foreign key relationships
   - RLS policy enforcement

2. **User-Facing Features** (90%+ required)
   - Component rendering
   - User interactions (clicks, form submissions)
   - Permission-based UI changes

3. **Error Handling** (80%+ required)
   - Network failures
   - Validation errors
   - Edge cases

4. **Utility Functions** (80%+ required)
   - Data transformations
   - Validation logic
   - Helpers

**Acceptable <90% Coverage:**
- Type definitions (`.types.ts` files)
- Mock utilities (test-only code)
- Experimental features (clearly marked)

### Checking Coverage

```bash
# Generate coverage report
npm run test -- --coverage

# View HTML report
open coverage/index.html
```

**Reading Report:**
- **Statements:** % of code lines executed
- **Branches:** % of if/else paths taken
- **Functions:** % of functions called
- **Lines:** % of lines executed

**Focus on:** Branches (most important for quality)

---

## Resources

### Key Files
- `/src/test/testUtils.tsx` - Test utilities and providers
- `/src/test/factories.ts` - Mock data factories
- `/src/test/setup.ts` - Global test configuration
- `/TESTING-ARCHITECTURE-AUDIT.md` - Detailed gap analysis

### Documentation
- [Vitest Docs](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/react)
- [React Query Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
- [Supabase Testing Patterns](https://supabase.com/docs/guides/local-development)

### Getting Help

**For test infrastructure issues:**
1. Check TEST-ARCHITECTURE-AUDIT.md for gap analysis
2. Look for similar passing tests as examples
3. Ask in team chat with specific error message

**For test strategy questions:**
1. Refer to Pattern sections above (which pattern to use?)
2. Check existing test files for examples
3. Consult with test-methodology-guardian for complex scenarios

---

**Last Updated:** 2025-10-13
**Maintained By:** universal-test-engineer
**Template For:** 6 remaining apps in EAV multi-repo suite
