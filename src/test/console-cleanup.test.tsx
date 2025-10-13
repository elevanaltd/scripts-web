/**
 * Console Cleanup Characterization Test
 *
 * TDD REMEDIATION: This test characterizes the console cleanup implementation
 * that was added in Checkpoint 3 without proper TDD discipline.
 *
 * Protocol: Red-Green-Refactor Retroactively
 * 1. SIMULATE RED: Add console.log to component render path
 * 2. ESTABLISH CONTRACT: Write failing test for console silence
 * 3. GO GREEN: Remove console.log, test must pass
 * 4. REGRESSION GUARD: Test permanently prevents console pollution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { TipTapEditor } from '../components/TipTapEditor'
import { NavigationProvider } from '../contexts/NavigationContext'

// Mock Supabase to prevent actual API calls during console testing
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    })
  }
}))

// Mock AuthContext to prevent auth-related console logs
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    userProfile: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    signup: vi.fn()
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock SmartSuite API to prevent network calls
vi.mock('../lib/smartsuite-api', () => ({
  SmartSuiteAPI: {
    fetchProjects: vi.fn().mockResolvedValue([]),
    fetchVideosForProject: vi.fn().mockResolvedValue([])
  }
}))

// Mock ScriptStatusContext
vi.mock('../contexts/ScriptStatusContext', () => ({
  useScriptStatus: () => ({
    status: 'idle',
    error: null,
    lastSaved: null,
    setStatus: vi.fn(),
    setError: vi.fn(),
    clearError: vi.fn(),
    clearScriptStatus: vi.fn()
  }),
  ScriptStatusProvider: ({ children }: { children: React.ReactNode }) => children
}))

describe('Console Cleanup Characterization', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Spy on all console methods to detect production pollution
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  /**
   * CONTRACT: Core components must not emit console logs during normal rendering
   *
   * This test ensures that:
   * 1. App component renders without console pollution
   * 2. No debug statements leak into production
   * 3. Console cleanup was successful
   *
   * RED STATE SIMULATION: If console.log('test-violation') is added to App.tsx,
   * this test MUST FAIL by detecting the console call
   */
  it('should render App component without console pollution', () => {
    // Render the main App component (App already includes Router)
    render(<App />)

    // CONTRACT: No console.log calls during normal rendering
    expect(consoleLogSpy, 'App component must not call console.log during render - production readiness requires clean console').not.toHaveBeenCalled()

    // Allow specific expected console calls but block debug pollution
    const allowedCalls = consoleLogSpy.mock.calls.filter(call => {
      const message = call[0]?.toString() || ''
      // Allow legitimate logging (auth state changes, errors, etc.)
      return message.includes('Auth state changed') ||
             message.includes('Error:') ||
             message.includes('Warning:')
    })

    expect(consoleLogSpy.mock.calls.length - allowedCalls.length,
      'Unexpected console.log calls detected - debug statements must be removed for production').toBe(0)
  })

  /**
   * CONTRACT: TipTap Editor must not emit debug console logs
   *
   * The editor is heavily used and should not pollute console
   */
  it('should render TipTap editor without console pollution', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // TipTap editor needs QueryClientProvider, NavigationProvider and ScriptStatusProvider
    render(
      <QueryClientProvider client={queryClient}>
        <NavigationProvider>
          <TipTapEditor />
        </NavigationProvider>
      </QueryClientProvider>
    )

    // Filter out legitimate editor logs (like extension loading)
    const debugCalls = consoleLogSpy.mock.calls.filter(call => {
      const message = call[0]?.toString() || ''
      // Block debug/development console statements
      return !message.includes('Tiptap') &&
             !message.includes('extension') &&
             !message.includes('Error:') &&
             !message.includes('Warning:')
    })

    expect(debugCalls.length,
      `TipTap editor emitted ${debugCalls.length} unexpected console.log calls - debug statements must be removed: ${debugCalls.map(c => c[0]).join(', ')}`).toBe(0)
  })

  /**
   * CONTRACT: Console warnings should be minimal in production
   *
   * Ensures cleanup addressed not just logs but also warnings
   */
  it('should have minimal console warnings during component rendering', () => {
    render(<App />)

    // Allow specific React warnings but block development warnings
    const developmentWarnings = consoleWarnSpy.mock.calls.filter(call => {
      const message = call[0]?.toString() || ''
      // Block development-only warnings
      return message.includes('dev') ||
             message.includes('debug') ||
             message.includes('TODO') ||
             message.includes('FIXME')
    })

    expect(developmentWarnings.length,
      `Found ${developmentWarnings.length} development warnings that should be removed: ${developmentWarnings.map(c => c[0]).join(', ')}`).toBe(0)
  })

  /**
   * REGRESSION GUARD: Prevent console pollution from creeping back in
   *
   * This test will catch any future console statements added to core paths
   */
  it('should maintain console cleanliness across component lifecycle', () => {
    const { rerender } = render(<App />)

    // Clear any initial calls
    consoleLogSpy.mockClear()
    consoleWarnSpy.mockClear()

    // Re-render to test lifecycle methods
    rerender(<App />)

    // Verify no new console pollution during re-render
    expect(consoleLogSpy, 'Component re-render must not introduce console pollution').not.toHaveBeenCalled()
    expect(consoleWarnSpy, 'Component re-render must not introduce warning pollution').not.toHaveBeenCalled()
  })
})

/**
 * CHARACTERIZATION HELPER: Simulate RED state by adding console pollution
 *
 * This helper can be used to test that the console cleanup test actually works
 * by temporarily adding console statements that should cause test failures.
 */
export function simulateConsolePollution() {
  // This would cause the test to fail if uncommented
  // console.log('test-violation: debug statement')
  // console.warn('test-violation: debug warning')
}