/**
 * Type declarations for env-schema.mjs
 *
 * Provides TypeScript type information for the shared environment schema module.
 */

import { z } from 'zod'

/**
 * Raw environment schema without transformations.
 * Used by pre-commit validation for actionable error messages.
 */
export declare const envSchema: z.ZodObject<{
  VITE_SUPABASE_URL: z.ZodString
  VITE_SUPABASE_PUBLISHABLE_KEY: z.ZodString
  VITE_DEBUG_MODE: z.ZodOptional<z.ZodString>
}>

/**
 * Runtime-transformed schema with defaults and type coercion.
 * Used by runtime config loader for application startup validation.
 */
export declare const envSchemaWithTransforms: z.ZodObject<{
  VITE_SUPABASE_URL: z.ZodString
  VITE_SUPABASE_PUBLISHABLE_KEY: z.ZodString
  VITE_DEBUG_MODE: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, boolean, string | undefined>
}>
