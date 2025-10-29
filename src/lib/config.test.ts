import { describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * TDD Phase: RED
 *
 * Tests for environment configuration loader with Zod validation.
 *
 * Purpose: Prevent PR #22 pattern (21 commits for env config issues)
 * Strategy: Fail-fast at startup with clear error messages
 *
 * Constitutional Requirement: Tests written BEFORE implementation
 */

describe('config loader', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...import.meta.env }
  })

  afterEach(() => {
    // Restore original environment
    Object.keys(import.meta.env).forEach(key => {
      delete import.meta.env[key]
    })
    Object.assign(import.meta.env, originalEnv)
  })

  describe('Supabase configuration', () => {
    it('should load valid Supabase URL', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const { loadConfig } = require('./config')
      const config = loadConfig()

      expect(config.supabase.url).toBe('https://example.supabase.co')
    })

    it('should load valid Supabase publishable key', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const { loadConfig } = require('./config')
      const config = loadConfig()

      expect(config.supabase.publishableKey).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    })

    it('should throw error when VITE_SUPABASE_URL is missing', () => {
      delete import.meta.env.VITE_SUPABASE_URL
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const { loadConfig } = require('./config')

      expect(() => loadConfig()).toThrow(/VITE_SUPABASE_URL/)
    })

    it('should throw error when VITE_SUPABASE_PUBLISHABLE_KEY is missing', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      delete import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

      const { loadConfig } = require('./config')

      expect(() => loadConfig()).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY/)
    })

    it('should throw error when VITE_SUPABASE_URL is invalid URL', () => {
      import.meta.env.VITE_SUPABASE_URL = 'not-a-url'
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const { loadConfig } = require('./config')

      expect(() => loadConfig()).toThrow(/invalid.*url/i)
    })
  })

  describe('debug mode', () => {
    it('should default debug mode to false when not set', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      delete import.meta.env.VITE_DEBUG_MODE

      const { loadConfig } = require('./config')
      const config = loadConfig()

      expect(config.debugMode).toBe(false)
    })

    it('should parse "true" string as boolean true', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      import.meta.env.VITE_DEBUG_MODE = 'true'

      const { loadConfig } = require('./config')
      const config = loadConfig()

      expect(config.debugMode).toBe(true)
    })

    it('should parse "false" string as boolean false', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      import.meta.env.VITE_DEBUG_MODE = 'false'

      const { loadConfig } = require('./config')
      const config = loadConfig()

      expect(config.debugMode).toBe(false)
    })
  })

  describe('error messages', () => {
    it('should provide clear error message with missing variable name', () => {
      delete import.meta.env.VITE_SUPABASE_URL
      delete import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

      const { loadConfig } = require('./config')

      expect(() => loadConfig()).toThrow(/environment variable/i)
    })

    it('should provide actionable error message pointing to .env.example', () => {
      delete import.meta.env.VITE_SUPABASE_URL

      const { loadConfig } = require('./config')

      expect(() => loadConfig()).toThrow(/.env.example/i)
    })
  })

  describe('immutability', () => {
    it('should return readonly configuration object', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

      const { loadConfig } = require('./config')
      const config = loadConfig()

      // TypeScript should prevent this at compile time
      // Runtime test verifies frozen object
      expect(() => {
        // @ts-expect-error - testing runtime immutability
        config.supabase.url = 'https://hacker.com'
      }).toThrow()
    })
  })
})
