/**
 * Shared environment variable schema.
 *
 * Purpose: Single source of truth for environment validation
 * Used by: Runtime config loader (config.ts) AND pre-commit validation (validate-env.mjs)
 *
 * Architecture: Plain JavaScript (.mjs) module importable by both TypeScript and Node.js CLI
 * Prevents schema duplication drift (code-review-specialist NO-GO finding)
 *
 * @module env-schema
 */

import { z } from 'zod'

/**
 * Zod schema for environment variable validation.
 *
 * Defines required and optional environment variables with validation rules.
 * Exported without transformations - runtime config applies transformations separately.
 *
 * @constant {z.ZodObject}
 */
export const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string({ required_error: 'VITE_SUPABASE_URL is required' })
    .url({ message: 'VITE_SUPABASE_URL must be a valid URL' })
    .min(1, 'VITE_SUPABASE_URL cannot be empty'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string({ required_error: 'VITE_SUPABASE_PUBLISHABLE_KEY is required' })
    .min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY cannot be empty'),
  VITE_DEBUG_MODE: z.string().optional(),
})

/**
 * Runtime-transformed schema with defaults and type coercion.
 *
 * Used by: Runtime config loader (config.ts)
 * Not used by: Pre-commit validation (validate-env.mjs) - needs raw values for actionable errors
 *
 * @constant {z.ZodObject}
 */
export const envSchemaWithTransforms = envSchema.extend({
  VITE_DEBUG_MODE: z
    .string()
    .optional()
    .default('false')
    .transform((val) => val === 'true'),
})
