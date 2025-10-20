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

/**
 * BroadcastChannel Polyfill for Node Test Environment
 *
 * **Issue**: Node.js BroadcastChannel expects `Event` instances, but Supabase Auth
 * (used by @elevanaltd/shared-lib) dispatches browser-standard `MessageEvent` instances
 * for cross-tab session synchronization.
 *
 * **Root Cause**: Node's BroadcastChannel implementation rejects MessageEvent:
 *   TypeError: The "event" argument must be an instance of Event. Received an instance of MessageEvent
 *    ❯ BroadcastChannel.dispatchEvent node:internal/event_target:757:13
 *
 * **Solution**: Stub BroadcastChannel with minimal test-compatible implementation.
 * In test environment, cross-tab sync isn't needed - we just need to prevent errors.
 *
 * **Impact**: Prevents 1,460+ test errors when Supabase Auth initializes BroadcastChannel
 * for session state synchronization across browser tabs.
 *
 * **Constitutional Basis**:
 * - I7 TDD Discipline: Ensures tests run without errors (RED→GREEN)
 * - I8 Production Quality: Quality gates enforcement (requirements-steward mandate)
 * - MINIMAL_INTERVENTION: Polyfill test environment only, no production code changes
 *
 * **References**:
 * - Quality Audit: coordination/reports/003-REPORT-QUALITY-AUDIT-SCRIPTS-WEB.md
 * - Requirements Ruling: coordination/reports/004-REPORT-REQUIREMENT-STEWARD-AUDIT.md (TD-001)
 * - Implementation Plan: coordination/workflow-docs/003-DETAILED-IMPLEMENTATION-PLAN-Q2.md
 */
class BroadcastChannelStub extends EventTarget {
  readonly name: string
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(name: string) {
    super()
    this.name = name
  }

  postMessage(message: unknown): void {
    // Synthesize MessageEvent to exercise broadcast logic in tests
    // This maintains test coverage while avoiding Node.js MessageEvent incompatibility
    const event = new Event('message') as MessageEvent
    Object.assign(event, { data: message })

    // Dispatch to addEventListener handlers
    this.dispatchEvent(event)

    // Also invoke onmessage callback if set
    if (typeof this.onmessage === 'function') {
      this.onmessage(event)
    }
  }

  close(): void {
    // Stub: No-op in test environment (no cleanup needed for in-memory stub)
  }
}

// Replace Node's incompatible BroadcastChannel with test-compatible stub
globalThis.BroadcastChannel = BroadcastChannelStub as typeof BroadcastChannel

// Mock shared library to inject test credentials
// Resolves 8 environment test failures by using v0.1.5 dependency injection pattern
vi.mock('@elevanaltd/shared-lib/client', async () => {
  const actual = await vi.importActual('@elevanaltd/shared-lib/client') as Record<string, unknown>
  return {
    ...actual,
    createBrowserClient: (url?: string, key?: string) => {
      // Override with test credentials when not provided
      return (actual.createBrowserClient as (url?: string, key?: string) => unknown)(
        url ?? 'https://test-project.supabase.co',
        key ?? 'test-anon-key'
      )
    }
  }
})

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