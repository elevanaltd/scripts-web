/**
 * ScriptLockContext - Shared Lock State Management (INFRASTRUCTURE)
 *
 * ARCHITECTURAL DECISION (2025-10-30):
 * Provides infrastructure to prevent concurrent lock acquisition bug by enforcing single acquisition point.
 *
 * **STATUS: INFRASTRUCTURE READY, MIGRATION REQUIRED**
 * - ✅ Context implementation complete and tested
 * - ⚠️ Production components NOT YET migrated (TipTapEditor, ScriptLockIndicator still use useScriptLock directly)
 * - ⚠️ TMG blocking decision PENDING until component migration complete
 * - 🔴 Bug still active in production until migration applied
 *
 * PROBLEM IDENTIFIED:
 * Multiple `useScriptLock` hook instances compete for same lock:
 * - Second instance steals lock from first
 * - User loses lock mid-edit
 * - Production impact: Phase 3-4 UI will mount two hooks (TipTapEditor + ScriptLockIndicator)
 *
 * SOLUTION PATTERN (when applied):
 * - TipTapEditor wraps content in ScriptLockProvider (owns lock)
 * - ScriptLockIndicator uses useScriptLockContext (reads state)
 * - Only one useScriptLock invocation per script ID
 *
 * WILL PREVENT (after migration):
 * - Multiple hook instances competing for same lock
 * - Lock stealing when mounting additional UI components
 * - Race conditions between editor and indicator
 *
 * VALIDATION:
 * - ✅ Infrastructure tested (regression test validates single acquisition)
 * - ✅ API design reviewed (code-review-specialist approved)
 * - ⚠️ Production integration pending (follow-up task required)
 * - ⚠️ TMG blocker remains RED until components migrated
 *
 * MIGRATION TASK REQUIRED:
 * 1. Update TipTapEditor to wrap in <ScriptLockProvider>
 * 2. Update ScriptLockIndicator to use useScriptLockContext()
 * 3. Verify only one lock acquisition per script in production
 * 4. Update TMG status to GREEN after validation
 *
 * @see src/hooks/useScriptLock.ts (underlying lock implementation)
 * @see src/contexts/ScriptLockContext.test.tsx (regression tests)
 * @see src/components/TipTapEditor.tsx (MIGRATION REQUIRED)
 * @see src/components/ScriptLockIndicator.tsx (MIGRATION REQUIRED)
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
// eslint-disable-next-line react-refresh/only-export-components
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
