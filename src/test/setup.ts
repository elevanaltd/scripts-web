/**
 * Global Test Setup
 *
 * Runs before all tests to configure the test environment.
 * Runs cleanup after each test to prevent state leakage.
 */

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