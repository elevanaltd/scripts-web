#!/usr/bin/env node

/**
 * TDD Phase: GREEN
 *
 * Pre-commit environment validation script.
 *
 * Purpose: Validate .env file before commit to prevent PR #22 pattern
 * Strategy: Node.js script validates .env against shared Zod schema
 *
 * Usage:
 *   node scripts/validate-env.mjs [.env file path]
 *   Default: .env
 *
 * Exit codes:
 *   0 - Validation passed
 *   1 - Validation failed
 */

import { readFileSync, existsSync } from 'node:fs'
import { z } from 'zod'
import { envSchema } from '../src/lib/env-schema.mjs'

/**
 * Shared environment schema imported from env-schema.mjs.
 *
 * Architecture: Single source of truth for validation rules
 * Prevents schema drift between runtime config and pre-commit validation
 *
 * Uses raw schema (no transformations) for actionable error messages
 * during pre-commit validation.
 */

/**
 * Parse .env file into key-value object.
 *
 * Handles:
 * - Comments (# prefix)
 * - Quoted values (single and double quotes)
 * - Empty lines
 * - Whitespace trimming
 *
 * @param {string} envPath - Path to .env file
 * @returns {Object} Parsed environment variables
 */
function parseEnvFile(envPath) {
  const content = readFileSync(envPath, 'utf-8')
  const env = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    // Parse KEY=VALUE
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      env[key] = value
    }
  }

  return env
}

/**
 * Validate .env file against schema.
 *
 * @param {string} envPath - Path to .env file (default: .env)
 * @returns {Object} Validation result
 *   - success: boolean
 *   - errors: string[]
 *   - message: string
 */
export function validateEnvFile(envPath = '.env') {
  try {
    // Check if file exists
    if (!existsSync(envPath)) {
      return {
        success: false,
        errors: [`File ${envPath} not found or missing`],
        message: `File ${envPath} not found or missing. Check your .env file against .env.example.`,
      }
    }

    // Parse .env file
    const env = parseEnvFile(envPath)

    // Validate against schema
    envSchema.parse(env)

    return {
      success: true,
      errors: [],
      message: 'Environment validation passed',
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = (error.issues || []).map((e) => `${e.path.join('.')}: ${e.message}`)

      return {
        success: false,
        errors,
        message: `Environment validation failed.\n\nPlease check your .env file against .env.example:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
      }
    }

    // Unexpected error
    return {
      success: false,
      errors: [error?.message || String(error)],
      message: `Unexpected error: ${error?.message || String(error)}`,
    }
  }
}

/**
 * CLI entry point.
 *
 * @param {string} envPath - Path to .env file (default: .env)
 * @returns {number} Exit code (0 = success, 1 = failure)
 */
export function main(envPath = '.env') {
  const result = validateEnvFile(envPath)

  if (result.success) {
    console.log('✓ Environment validation passed')
    return 0
  } else {
    console.error('✗ Environment validation failed\n')
    console.error(result.message)
    return 1
  }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const envPath = process.argv[2] || '.env'
  const exitCode = main(envPath)
  process.exit(exitCode)
}
