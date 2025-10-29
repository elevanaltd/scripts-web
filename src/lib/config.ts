import { z } from 'zod'
import { envSchemaWithTransforms } from './env-schema.mjs'

/**
 * TDD Phase: REFACTOR
 *
 * Environment configuration loader with Zod validation.
 *
 * Purpose: Prevent PR #22 pattern (21 commits for env config issues)
 * Strategy: Fail-fast at startup with clear error messages
 *
 * Implementation: Tests 100% passing (11/11) - refactoring for clarity
 *
 * Architecture: Imports shared schema from env-schema.mjs (single source of truth)
 * Prevents schema drift between runtime and pre-commit validation
 */

// Configuration type derived from schema
type Config = {
  supabase: {
    url: string
    publishableKey: string
  }
  debugMode: boolean
}

/**
 * Deep freeze an object to prevent mutations at all levels.
 */
function deepFreeze<T extends Record<string, unknown>>(obj: T): Readonly<T> {
  Object.freeze(obj)
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = obj[prop]
    if (value && typeof value === 'object') {
      deepFreeze(value as Record<string, unknown>)
    }
  })
  return obj
}

/**
 * Load and validate environment configuration.
 *
 * @throws {Error} When required environment variables are missing or invalid
 * @returns {Readonly<Config>} Immutable configuration object
 */
export function loadConfig(): Readonly<Config> {
  try {
    const env = envSchemaWithTransforms.parse({
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE,
    })

    const config: Config = {
      supabase: {
        url: env.VITE_SUPABASE_URL,
        publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      debugMode: env.VITE_DEBUG_MODE,
    }

    // Deep freeze object to prevent mutations at all levels
    return deepFreeze(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = (error.issues || []).map((e) => e.path.join('.')).join(', ')
      const errorDetails = (error.issues || [])
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n')
      throw new Error(
        `Environment variable validation failed: ${missingVars}\n\n` +
          `Please check your .env file against .env.example:\n${errorDetails}`
      )
    }
    throw error
  }
}

/**
 * Get validated configuration instance.
 *
 * Singleton pattern - configuration is loaded once and cached.
 * For testing, import loadConfig directly and call it per-test with stubbed env.
 */
let cachedConfig: Readonly<Config> | null = null

export function getConfig(): Readonly<Config> {
  if (!cachedConfig) {
    cachedConfig = loadConfig()
  }
  return cachedConfig
}
