/**
 * Test Utilities - Provider Wrappers for Testing
 *
 * Provides standardized test wrappers that mirror production provider stack.
 *
 * Production Stack:
 * QueryClientProvider → AuthProvider → Router → NavigationProvider → ScriptStatusProvider → Component
 *
 * Usage:
 * ```tsx
 * import { renderWithProviders } from './test/testUtils'
 *
 * // Basic test (QueryClient + Auth)
 * renderWithProviders(<MyComponent />)
 *
 * // With auth user
 * renderWithProviders(<MyComponent />, {
 *   authUser: { id: 'user-1', email: 'test@example.com' }
 * })
 *
 * // With routing
 * renderWithProviders(<MyComponent />, {
 *   router: { initialEntries: ['/path'] }
 * })
 *
 * // Full integration (all providers)
 * renderWithProviders(<MyComponent />, {
 *   authUser: { id: 'user-1', email: 'test@example.com' },
 *   router: { initialEntries: ['/'] },
 *   includeNavigation: true,
 *   includeScriptStatus: true
 * })
 * ```
 */

/* eslint-disable react-refresh/only-export-components */
import React, { ReactElement } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom'
import { User } from '@supabase/supabase-js'

/**
 * Test-specific QueryClient configuration
 * - No retries (faster test failures)
 * - No refetching (deterministic tests)
 * - Short stale times (immediate invalidation visible)
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // No retries in tests
        gcTime: Infinity, // Never garbage collect during tests
        staleTime: 0, // Data immediately stale (tests can observe refetching)
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false, // No retries in tests
      },
    },
    // Note: logger removed in @tanstack/react-query v5 - logs suppressed by default in tests
  })
}

/**
 * Mock AuthContext value for tests
 */
export interface MockAuthUser {
  id: string
  email: string
  role?: 'admin' | 'employee' | 'client' | null
  display_name?: string | null
  client_filter?: string | null
}

/**
 * Creates mock User object matching Supabase User type
 */
export function createMockUser(options: MockAuthUser): User {
  return {
    id: options.id,
    email: options.email,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {
      full_name: options.display_name || options.email,
    },
  } as User
}

/**
 * Creates mock UserProfile matching database type
 */
export function createMockUserProfile(options: MockAuthUser) {
  return {
    id: options.id,
    email: options.email,
    display_name: options.display_name || null,
    role: options.role || 'client',
    created_at: new Date().toISOString(),
    client_filter: options.client_filter || null,
  }
}

/**
 * Mock AuthProvider for tests
 * Provides auth context without Supabase dependency
 */
interface MockAuthProviderProps {
  children: React.ReactNode
  mockUser?: MockAuthUser | null
}

function MockAuthProvider({ children, mockUser }: MockAuthProviderProps) {
  const currentUser = mockUser ? createMockUser(mockUser) : null
  const userProfile = mockUser ? createMockUserProfile(mockUser) : null

  const authValue = {
    currentUser,
    userProfile,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    logout: vi.fn().mockResolvedValue(undefined),
    loading: false,
  }

  // Create context directly instead of importing (avoids circular dependency)
  const AuthContext = React.createContext(authValue)

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
}

/**
 * Test render options
 */
export interface TestRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Mock authenticated user (null = unauthenticated) */
  authUser?: MockAuthUser | null

  /** Include MemoryRouter for routing tests */
  router?: Partial<MemoryRouterProps>

  /** Include NavigationProvider (for integration tests) */
  includeNavigation?: boolean

  /** Include ScriptStatusProvider (for integration tests) */
  includeScriptStatus?: boolean

  /** Custom QueryClient (auto-created if not provided) */
  queryClient?: QueryClient
}

/**
 * Renders component with standard test providers
 *
 * Always includes:
 * - QueryClientProvider (with test-specific config)
 * - MockAuthProvider (authenticated or unauthenticated)
 *
 * Optional:
 * - MemoryRouter (for routing tests)
 * - NavigationProvider (for integration tests)
 * - ScriptStatusProvider (for integration tests)
 *
 * @param ui - Component to render
 * @param options - Test configuration options
 * @returns Render result with queryClient for assertions
 */
export function renderWithProviders(
  ui: ReactElement,
  options: TestRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const {
    authUser = null,
    router,
    includeNavigation = false,
    includeScriptStatus = false,
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options

  // Build provider stack (innermost to outermost)
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    let content = children

    // Innermost: ScriptStatusProvider (if needed)
    if (includeScriptStatus) {
      // Import would cause circular dependency, so we skip for now
      // Tests requiring ScriptStatusProvider should mock it directly
      console.warn('ScriptStatusProvider not yet supported in testUtils')
    }

    // NavigationProvider (if needed)
    if (includeNavigation) {
      // Import would cause circular dependency, so we skip for now
      // Tests requiring NavigationProvider should mock it directly
      console.warn('NavigationProvider not yet supported in testUtils')
    }

    // Router (if needed)
    if (router) {
      const { initialEntries = ['/'], ...routerProps } = router
      content = (
        <MemoryRouter initialEntries={initialEntries} {...routerProps}>
          {content}
        </MemoryRouter>
      )
    }

    // AuthProvider (always included)
    content = <MockAuthProvider mockUser={authUser}>{content}</MockAuthProvider>

    // Outermost: QueryClientProvider (always included)
    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
  }

  const renderResult = render(ui, { wrapper: Wrapper, ...renderOptions })

  return {
    ...renderResult,
    queryClient,
  }
}

/**
 * Convenience function: render with admin user
 */
export function renderWithAdmin(ui: ReactElement, options: Omit<TestRenderOptions, 'authUser'> = {}) {
  return renderWithProviders(ui, {
    ...options,
    authUser: {
      id: 'admin-user',
      email: 'admin@eav.app',
      role: 'admin',
      display_name: 'Admin User',
    },
  })
}

/**
 * Convenience function: render with employee user
 */
export function renderWithEmployee(ui: ReactElement, options: Omit<TestRenderOptions, 'authUser'> = {}) {
  return renderWithProviders(ui, {
    ...options,
    authUser: {
      id: 'employee-user',
      email: 'employee@eav.app',
      role: 'employee',
      display_name: 'Employee User',
    },
  })
}

/**
 * Convenience function: render with client user
 */
export function renderWithClient(ui: ReactElement, options: Omit<TestRenderOptions, 'authUser'> = {}) {
  return renderWithProviders(ui, {
    ...options,
    authUser: {
      id: 'client-user',
      email: 'client@example.com',
      role: 'client',
      display_name: 'Client User',
    },
  })
}

/**
 * Convenience function: render unauthenticated
 */
export function renderUnauthenticated(ui: ReactElement, options: Omit<TestRenderOptions, 'authUser'> = {}) {
  return renderWithProviders(ui, {
    ...options,
    authUser: null,
  })
}

/**
 * Creates a mock useAuth return value for tests that need to mock useAuth directly
 * (without using AuthProvider wrapper)
 *
 * Usage:
 * ```tsx
 * vi.mock('@/contexts/AuthContext', () => ({
 *   useAuth: vi.fn()
 * }))
 *
 * beforeEach(() => {
 *   vi.mocked(useAuth).mockReturnValue(mockUseAuth())
 * })
 * ```
 */
export function mockUseAuth(overrides: Partial<MockAuthUser> = {}) {
  const defaultUser: MockAuthUser = {
    id: 'test-user',
    email: 'test@example.com',
    role: 'admin',
    display_name: 'Test User',
    ...overrides,
  }

  return {
    currentUser: createMockUser(defaultUser),
    userProfile: createMockUserProfile(defaultUser),
    loading: false,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    logout: vi.fn().mockResolvedValue(undefined),
  }
}

/**
 * Wait for QueryClient to be idle (all queries settled)
 * Useful for integration tests with async data fetching
 */
export async function waitForQueryIdle(queryClient: QueryClient): Promise<void> {
  await new Promise<void>((resolve) => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (queryClient.isFetching() === 0) {
        unsubscribe()
        resolve()
      }
    })

    // Immediately resolve if already idle
    if (queryClient.isFetching() === 0) {
      unsubscribe()
      resolve()
    }
  })
}
