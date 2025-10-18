import { createBrowserClient } from '@elevanaltd/shared-lib/client'

// Critical-Engineer: consulted for shared library integration and type safety
// Decision: peerDependencies pattern prevents duplicate @supabase/supabase-js modules
// Validation: TypeScript 0 errors, single module version, type compatibility enforced
// Build discipline: All quality gates must pass before merge

// Supabase client initialization using shared library
export const supabase = createBrowserClient()