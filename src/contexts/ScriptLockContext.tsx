/**
 * ScriptLockContext - Shared Lock State Management (INFRASTRUCTURE)
 *
 * ARCHITECTURAL DECISION (2025-10-30):
 * Provides infrastructure to prevent concurrent lock acquisition bug by enforcing single acquisition point.
 *
 * **STATUS: PARTIAL MIGRATION COMPLETE**
 * - ✅ Context implementation complete and tested
 * - ✅ TipTapEditor migrated to ScriptLockProvider (2025-10-31)
 * - ⚠️ ScriptLockIndicator still uses useScriptLock directly (pending migration)
 * - ⚠️ Bug risk reduced but not eliminated until ScriptLockIndicator migrated
 * - Last updated: 2025-10-31
 *
 * PROBLEM IDENTIFIED:
 * Multiple `useScriptLock` hook instances compete for same lock:
 * - Second instance steals lock from first
 * - User loses lock mid-edit
 * - Production impact: Phase 3-4 UI will mount two hooks (TipTapEditor + ScriptLockIndicator)
 *
 * SOLUTION PATTERN (partially applied):
 * - ✅ TipTapEditor wraps content in ScriptLockProvider (owns lock) - line 57
 * - ⚠️ ScriptLockIndicator still uses useScriptLock (creates duplicate acquisition) - line 111
 * - Goal: Only one useScriptLock invocation per script ID
 *
 * PREVENTS (after full migration):
 * - Multiple hook instances competing for same lock
 * - Lock stealing when mounting additional UI components
 * - Race conditions between editor and indicator
 *
 * VALIDATION:
 * - ✅ Infrastructure tested (regression test validates single acquisition)
 * - ✅ API design reviewed (code-review-specialist approved)
 * - ✅ TipTapEditor integration complete
 * - ⚠️ ScriptLockIndicator migration pending
 *
 * REMAINING MIGRATION TASK:
 * 1. ✅ Update TipTapEditor to wrap in <ScriptLockProvider> (COMPLETE)
 * 2. ⚠️ Update ScriptLockIndicator to use useScriptLockContext() (PENDING)
 * 3. ⚠️ Verify only one lock acquisition per script in production (PENDING)
 * 4. ⚠️ Update status to COMPLETE after validation
 *
 * @see src/hooks/useScriptLock.ts (underlying lock implementation)
 * @see src/contexts/ScriptLockContext.test.tsx (regression tests)
 * @see src/components/TipTapEditor.tsx (✅ MIGRATED - line 57)
 * @see src/components/ScriptLockIndicator.tsx (⚠️ MIGRATION PENDING - line 111)
 */

import { createContext, useContext, ReactNode } from 'react'
import { useScriptLock, ScriptLockStatus } from '../hooks/useScriptLock'
import type { SupabaseClient } from '@supabase/supabase-js'

// Generic Database type to accept both local and shared-lib Database types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any

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
 * @param scriptId - UUID of script to lock (undefined when no script selected)
 * @param children - Components that will consume lock state
 * @param client - Optional Supabase client for dependency injection (tests)
 */
interface ScriptLockProviderProps {
  scriptId: string | undefined
  children: ReactNode
  client?: SupabaseClient<AnyDatabase>
}

export function ScriptLockProvider({ scriptId, children, client }: ScriptLockProviderProps) {
  // Single acquisition point - all children share this state
  // When scriptId is undefined, useScriptLock returns unlocked state
  const lockState = useScriptLock(scriptId, client)

  return <ScriptLockContext.Provider value={lockState}>{children}</ScriptLockContext.Provider>
}
