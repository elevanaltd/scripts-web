/**
 * Supabase Type Helpers
 *
 * Workaround for TypeScript inference limitations with complex Database types.
 * When Supabase's generated types become too complex, TypeScript fails to properly
 * infer available tables and functions, causing false "not assignable" errors.
 *
 * These helpers provide explicit type casting to bypass inference issues while
 * maintaining type safety for the actual data structures.
 *
 * **Dependency Injection Pattern:**
 * - Functions accept a SupabaseClient parameter to enable test vs production separation
 * - Production code: Use default parameter (no changes required)
 * - Test code: Explicitly pass testSupabase client configured for localhost
 * - Architectural coherence: Client is injected, not environment-detected
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import { supabase } from './supabase'

// Generic Database type to accept both local and shared-lib Database types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any

// Type aliases for script_locks operations
export type AcquireLockResponse = Database['public']['Functions']['acquire_script_lock']['Returns'][0]
export type ScriptLockRow = Database['public']['Tables']['script_locks']['Row']
export type ScriptLockInsert = Database['public']['Tables']['script_locks']['Insert']
export type ScriptLockUpdate = Database['public']['Tables']['script_locks']['Update']

/**
 * Type-safe wrapper for acquire_script_lock RPC call
 *
 * @param client - Supabase client instance (allows test vs production injection)
 * @param scriptId - UUID of script to lock
 *
 * Note: Client parameter enables dependency injection:
 * - Production: Pass production supabase client (default)
 * - Tests: Pass testSupabase client configured for localhost
 *
 * Type casting required due to Supabase TypeScript inference limitations
 * with complex Database schemas. The database types are correctly defined in
 * database.types.ts, but TypeScript fails to infer them properly.
 */
export async function acquireScriptLock(
  client: SupabaseClient<AnyDatabase>,
  scriptId: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (client.rpc as any)('acquire_script_lock', {
    p_script_id: scriptId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as { data: AcquireLockResponse[] | null; error: any }
}

/**
 * Type-safe wrapper for script_locks table operations
 *
 * @param client - Supabase client instance (allows test vs production injection)
 *
 * Note: Type casting required due to Supabase TypeScript inference limitations
 * with complex Database schemas. The database types are correctly defined in
 * database.types.ts, but TypeScript fails to infer them properly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scriptLocksTable = (client: SupabaseClient<AnyDatabase>) => (client.from as any)('script_locks')

/**
 * Production-ready helpers with default client
 * Use these in production code for convenience (maintain backward compatibility)
 */
export const acquireScriptLockProd = (scriptId: string) =>
  acquireScriptLock(supabase, scriptId)

export const scriptLocksTableProd = () =>
  scriptLocksTable(supabase)
