/**
 * Supabase Type Helpers
 *
 * Workaround for TypeScript inference limitations with complex Database types.
 * When Supabase's generated types become too complex, TypeScript fails to properly
 * infer available tables and functions, causing false "not assignable" errors.
 *
 * These helpers provide explicit type casting to bypass inference issues while
 * maintaining type safety for the actual data structures.
 */

import type { Database } from '../types/database.types'
import { supabase } from './supabase'

// Type aliases for script_locks operations
export type AcquireLockResponse = Database['public']['Functions']['acquire_script_lock']['Returns'][0]
export type ScriptLockRow = Database['public']['Tables']['script_locks']['Row']
export type ScriptLockInsert = Database['public']['Tables']['script_locks']['Insert']
export type ScriptLockUpdate = Database['public']['Tables']['script_locks']['Update']

/**
 * Type-safe wrapper for acquire_script_lock RPC call
 *
 * Note: Type casting required due to Supabase TypeScript inference limitations
 * with complex Database schemas. The database types are correctly defined in
 * database.types.ts, but TypeScript fails to infer them properly.
 */
export async function acquireScriptLock(scriptId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (supabase.rpc as any)('acquire_script_lock', {
    p_script_id: scriptId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as { data: AcquireLockResponse[] | null; error: any }
}

/**
 * Type-safe wrapper for script_locks table operations
 *
 * Note: Type casting required due to Supabase TypeScript inference limitations
 * with complex Database schemas. The database types are correctly defined in
 * database.types.ts, but TypeScript fails to infer them properly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scriptLocksTable = () => (supabase.from as any)('script_locks')
