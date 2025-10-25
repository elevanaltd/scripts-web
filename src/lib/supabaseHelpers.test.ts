/**
 * Supabase Helpers - Type Infrastructure Tests
 *
 * NOTE: These are TypeScript type aliases and wrappers for Supabase type inference issues.
 * The actual functionality is tested via integration tests (useScriptLock.test.ts, scriptLocks.test.ts).
 *
 * This test file primarily validates type exports compile correctly.
 */

import { describe, it, expect } from 'vitest'
import type { AcquireLockResponse, ScriptLockRow } from './supabaseHelpers'

describe('supabaseHelpers - Type Infrastructure', () => {
  it('should export AcquireLockResponse type', () => {
    // Type test - ensures type compiles
    const mockResponse: AcquireLockResponse = {
      success: true,
      locked_by_user_id: 'test-id',
      locked_by_name: 'Test User',
      locked_at: new Date().toISOString(),
    }

    expect(mockResponse.success).toBe(true)
  })

  it('should export ScriptLockRow type', () => {
    // Type test - ensures type compiles
    const mockRow: ScriptLockRow = {
      script_id: 'test-script',
      locked_by: 'test-user',
      locked_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      is_manual_unlock: false,
    }

    expect(mockRow.script_id).toBe('test-script')
  })

  // Functional tests are in useScriptLock.test.ts and scriptLocks.test.ts
})
