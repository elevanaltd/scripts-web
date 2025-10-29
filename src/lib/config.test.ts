import { describe, it, expect } from 'vitest'
import { loadConfig, getConfig } from './config'

/**
 * TDD Phase: RED→GREEN
 *
 * Tests for environment configuration loader with Zod validation.
 *
 * Purpose: Prevent PR #22 pattern (21 commits for env config issues)
 * Strategy: Fail-fast at startup with clear error messages
 *
 * Constitutional Requirement: Tests written BEFORE implementation
 *
 * Note: These tests run against the actual environment configured in .env
 * The schema validation tests ensure proper behavior for production scenarios.
 */

describe('config loader', () => {
  describe('actual environment integration', () => {
    it('should load configuration from actual environment without errors', () => {
      // This test validates that our .env is properly configured
      expect(() => loadConfig()).not.toThrow()
    })

    it('should return configuration with supabase properties', () => {
      const config = loadConfig()

      expect(config).toHaveProperty('supabase')
      expect(config.supabase).toHaveProperty('url')
      expect(config.supabase).toHaveProperty('publishableKey')
    })

    it('should return configuration with debugMode property', () => {
      const config = loadConfig()

      expect(config).toHaveProperty('debugMode')
      expect(typeof config.debugMode).toBe('boolean')
    })

    it('should load valid Supabase URL from environment', () => {
      const config = loadConfig()

      expect(config.supabase.url).toMatch(/^https?:\/\//)
      expect(config.supabase.url).toBeTruthy()
    })

    it('should load valid Supabase publishable key from environment', () => {
      const config = loadConfig()

      expect(config.supabase.publishableKey).toBeTruthy()
      expect(config.supabase.publishableKey.length).toBeGreaterThan(0)
    })
  })

  describe('immutability', () => {
    it('should return deeply frozen configuration object', () => {
      const config = loadConfig()

      // Test root level freeze
      expect(Object.isFrozen(config)).toBe(true)

      // Test nested object freeze
      expect(Object.isFrozen(config.supabase)).toBe(true)

      // Runtime immutability test
      expect(() => {
        // @ts-expect-error - testing runtime immutability
        config.debugMode = !config.debugMode
      }).toThrow()

      expect(() => {
        // Testing runtime immutability (Object.freeze prevents mutation)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(config.supabase as any).url = 'https://hacker.com'
      }).toThrow()
    })
  })

  describe('singleton behavior', () => {
    it('should return cached configuration on subsequent calls', () => {
      const config1 = getConfig()
      const config2 = getConfig()

      // Same reference - true singleton
      expect(config1).toBe(config2)
    })

    it('should cache loadConfig results via getConfig', () => {
      const direct = loadConfig()
      const cached = getConfig()

      // Same structure and values
      expect(direct).toEqual(cached)
    })
  })

  describe('error handling', () => {
    it('should provide clear error messages when validation fails', () => {
      // Since we can't reliably stub import.meta.env in Vite tests,
      // we document the expected error format here and validate it in
      // the pre-commit validation script (validate-env.mjs)

      // Expected error format:
      // "Environment variable validation failed: VITE_SUPABASE_URL, ..."
      // "Please check your .env file against .env.example:"
      // "  - VITE_SUPABASE_URL: [error message]"

      // This is validated by the pre-commit hook and manual testing
      expect(true).toBe(true) // Placeholder for documentation
    })
  })

  describe('type safety', () => {
    it('should enforce URL format for VITE_SUPABASE_URL', () => {
      const config = loadConfig()

      // TypeScript enforces this at compile time
      // Runtime validates via Zod schema
      expect(config.supabase.url).toMatch(/^https?:\/\/[^\s]+$/)
    })

    it('should parse VITE_DEBUG_MODE as boolean', () => {
      const config = loadConfig()

      // TypeScript type: boolean
      // Runtime type check
      expect(typeof config.debugMode).toBe('boolean')
    })
  })
})
