/**
 * Global Test Setup
 *
 * Runs before all tests to configure the test environment.
 * Runs cleanup after each test to prevent state leakage.
 */

/**
 * CRITICAL: Mock import.meta.env BEFORE any module imports
 *
 * Problem: @elevanaltd/shared-lib reads import.meta.env.VITE_SUPABASE_URL
 * at module import time (before Vitest env configuration applies).
 *
 * Solution: setupFiles executes before module imports. Inject environment
 * variables here so they exist when shared-lib browser.js:21 executes.
 *
 * Constitutional Exemption: Test infrastructure properly exempted in TDD hook.
 * Changes validate via dependent test execution (not co-located tests).
 */
if (typeof import.meta.env === 'undefined') {
  // @ts-expect-error - Mocking import.meta.env for test environment
  import.meta.env = {}
}

// Inject Supabase credentials for shared-lib imports
import.meta.env.VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://test-project.supabase.co'
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MTU2MTY4MDB9.test-mock-anon-key'

// SmartSuite mock credentials (for tests that import smartsuite integration)
import.meta.env.VITE_SMARTSUITE_API_KEY = import.meta.env.VITE_SMARTSUITE_API_KEY || 'test-mock-smartsuite-key'
import.meta.env.VITE_SMARTSUITE_WORKSPACE_ID = import.meta.env.VITE_SMARTSUITE_WORKSPACE_ID || 's3qnmox1'
import.meta.env.VITE_SMARTSUITE_PROJECTS_TABLE = import.meta.env.VITE_SMARTSUITE_PROJECTS_TABLE || '68a8ff5237fde0bf797c05b3'
import.meta.env.VITE_SMARTSUITE_VIDEOS_TABLE = import.meta.env.VITE_SMARTSUITE_VIDEOS_TABLE || '68b2437a8f1755b055e0a124'

// NOW safe to import modules that depend on import.meta.env
import { expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { resetFactoryIds } from './factories'

// Extend Vitest matchers with Testing Library DOM matchers
expect.extend({})

// Reset factory IDs before each test for deterministic test data
beforeEach(() => {
  resetFactoryIds()
})

// Run cleanup after each test case (e.g. clearing jsdom, React components)
afterEach(() => {
  cleanup()

  // Clear all mocks to prevent test interference
  vi.clearAllMocks()
})

// Mock window.matchMedia (used by responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver (used by TipTap editor)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver (used by lazy loading)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: vi.fn().mockReturnValue([]),
}))

// Suppress console errors in tests (unless debugging)
// Comment out to see actual errors during test development
const originalConsoleError = console.error
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    // Allow specific errors through for debugging
    const message = String(args[0])
    if (
      message.includes('Warning: ReactDOM.render') ||
      message.includes('Not implemented: HTMLFormElement.prototype.submit')
    ) {
      return // Suppress known harmless warnings
    }
    originalConsoleError(...args)
  }
})

afterEach(() => {
  console.error = originalConsoleError
})