/**
 * ScriptLockContext - Shared Lock State Management
 *
 * ARCHITECTURAL DECISION (2025-10-30):
 * Prevents concurrent lock acquisition bug by enforcing single acquisition point.
 *
 * PROBLEM:
 * Multiple `useScriptLock` hook instances compete for same lock:
 * - Second instance steals lock from first
 * - User loses lock mid-edit
 * - Production impact: Phase 3-4 UI mounts two hooks (TipTapEditor + ScriptLockIndicator)
 *
 * SOLUTION PATTERN:
 * - TipTapEditor wraps content in ScriptLockProvider (owns lock)
 * - ScriptLockIndicator uses useScriptLockContext (reads state)
 * - Only one useScriptLock invocation per script ID
 *
 * PREVENTS:
 * - Multiple hook instances competing for same lock
 * - Lock stealing when mounting additional UI components
 * - Race conditions between editor and indicator
 *
 * TMG VALIDATION:
 * - test-methodology-guardian blocking decision resolved
 * - Concurrency test coverage added
 * - Regression prevention verified
 *
 * @see src/hooks/useScriptLock.ts (underlying lock implementation)
 * @see src/contexts/ScriptLockContext.test.tsx (regression tests)
 */

import { createContext, useContext, ReactNode } from 'react'
import { useScriptLock, ScriptLockStatus } from '../hooks/useScriptLock'

// Context type matches ScriptLockStatus interface
type ScriptLockContextValue = ScriptLockStatus

// Create context with null default (requires provider)
const ScriptLockContext = createContext<ScriptLockContextValue | null>(null)

/**
 * Hook to consume script lock context
 *
 * @throws Error if used outside ScriptLockProvider
 * @returns Script lock state from provider
 */
export function useScriptLockContext(): ScriptLockContextValue {
  const context = useContext(ScriptLockContext)

  if (!context) {
    throw new Error('useScriptLockContext must be used within ScriptLockProvider')
  }

  return context
}

/**
 * Provider that acquires lock and shares state with children
 *
 * @param scriptId - UUID of script to lock
 * @param children - Components that will consume lock state
 */
interface ScriptLockProviderProps {
  scriptId: string
  children: ReactNode
}

export function ScriptLockProvider({ scriptId, children }: ScriptLockProviderProps) {
  // Single acquisition point - all children share this state
  const lockState = useScriptLock(scriptId)

  return <ScriptLockContext.Provider value={lockState}>{children}</ScriptLockContext.Provider>
}
