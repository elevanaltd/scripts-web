/**
 * TDD Phase: RED
 *
 * Tests for pre-commit environment validation script.
 *
 * Purpose: Validate .env file before commit to prevent PR #22 pattern
 * Strategy: Node.js script tests .env file against Zod schema
 *
 * Constitutional Requirement: Tests written BEFORE implementation
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const TEST_ENV_FILE = '.env.test'

describe('validate-env script', () => {
  beforeEach(() => {
    // Clean up test file if it exists
    if (existsSync(TEST_ENV_FILE)) {
      unlinkSync(TEST_ENV_FILE)
    }
  })

  afterEach(() => {
    // Clean up test file
    if (existsSync(TEST_ENV_FILE)) {
      unlinkSync(TEST_ENV_FILE)
    }
  })

  describe('valid environment', () => {
    it('should pass validation with complete valid .env file', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
VITE_DEBUG_MODE=false`
      )

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, true)
      assert.strictEqual(result.errors.length, 0)
    })

    it('should pass validation with optional VITE_DEBUG_MODE missing', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
      )

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, true)
    })

    it('should pass validation with VITE_DEBUG_MODE=true', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
VITE_DEBUG_MODE=true`
      )

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, true)
    })
  })

  describe('invalid environment', () => {
    it('should fail validation with missing VITE_SUPABASE_URL', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
      )

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, false)
      assert.ok(result.errors.some((e) => e.includes('VITE_SUPABASE_URL')))
    })

    it('should fail validation with missing VITE_SUPABASE_PUBLISHABLE_KEY', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `VITE_SUPABASE_URL=https://example.supabase.co`
      )

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, false)
      assert.ok(result.errors.some((e) => e.includes('VITE_SUPABASE_PUBLISHABLE_KEY')))
    })

    it('should fail validation with invalid URL format', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `VITE_SUPABASE_URL=not-a-valid-url
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
      )

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, false)
      assert.ok(result.errors.some((e) => e.includes('valid URL')))
    })

    it('should fail validation with empty file', async () => {
      writeFileSync(TEST_ENV_FILE, '')

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, false)
      assert.ok(result.errors.length > 0)
    })
  })

  describe('error messages', () => {
    it('should provide actionable error messages with variable names', async () => {
      writeFileSync(TEST_ENV_FILE, '')

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, false)
      // Should mention .env.example for reference
      assert.ok(result.message.includes('.env.example'))
    })

    it('should list all missing variables in error message', async () => {
      writeFileSync(TEST_ENV_FILE, '')

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.ok(result.errors.some((e) => e.includes('VITE_SUPABASE_URL')))
      assert.ok(result.errors.some((e) => e.includes('VITE_SUPABASE_PUBLISHABLE_KEY')))
    })
  })

  describe('file handling', () => {
    it('should handle missing .env file gracefully', async () => {
      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile('nonexistent.env')

      assert.strictEqual(result.success, false)
      assert.ok(result.message.includes('not found') || result.message.includes('missing'))
    })

    it('should parse comments in .env file', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `# Comment line
VITE_SUPABASE_URL=https://example.supabase.co
# Another comment
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
      )

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, true)
    })

    it('should parse environment variables with quotes', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `VITE_SUPABASE_URL="https://example.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'`
      )

      const { validateEnvFile } = await import('./validate-env.mjs')
      const result = validateEnvFile(TEST_ENV_FILE)

      assert.strictEqual(result.success, true)
    })
  })

  describe('CLI integration', () => {
    it('should export main function for CLI usage', async () => {
      const module = await import('./validate-env.mjs')

      assert.ok(typeof module.validateEnvFile === 'function')
      assert.ok(typeof module.main === 'function')
    })

    it('should return exit code 0 for valid env', async () => {
      writeFileSync(
        TEST_ENV_FILE,
        `VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`
      )

      const { main } = await import('./validate-env.mjs')
      const exitCode = main(TEST_ENV_FILE)

      assert.strictEqual(exitCode, 0)
    })

    it('should return exit code 1 for invalid env', async () => {
      writeFileSync(TEST_ENV_FILE, '')

      const { main } = await import('./validate-env.mjs')
      const exitCode = main(TEST_ENV_FILE)

      assert.strictEqual(exitCode, 1)
    })
  })
})
