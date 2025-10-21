import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Logger } from './logger'

describe('Logger Service', () => {
  let mockConsole: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    mockConsole = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    }

    // Mock console methods
    Object.assign(console, mockConsole)

    // Reset environment
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Log Level Configuration', () => {
    it('should fail - Logger class should exist with proper interface', () => {
      // CONTRACT: Logger should be a class with static methods
      expect(typeof Logger).toBe('function')
      expect(typeof Logger.info).toBe('function')
      expect(typeof Logger.warn).toBe('function')
      expect(typeof Logger.error).toBe('function')
      expect(typeof Logger.debug).toBe('function')
    })

    it('should fail - Logger should respect log levels in production', () => {
      // CONTRACT: In production, debug logs should be suppressed
      vi.stubEnv('NODE_ENV', 'production')

      Logger.debug('Debug message', { data: 'test' })

      // DEBUG should NOT appear in production console
      expect(mockConsole.debug).not.toHaveBeenCalled()
      expect(mockConsole.log).not.toHaveBeenCalled()
    })

    it('should fail - Logger should allow debug logs in development', () => {
      // CONTRACT: In development, all log levels should work
      vi.stubEnv('NODE_ENV', 'development')

      Logger.debug('Debug message', { data: 'test' })

      // DEBUG should appear in development
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        expect.stringContaining('Debug message'),
        expect.objectContaining({ data: 'test' })
      )
    })
  })

  describe('Structured Logging Format', () => {
    it('should fail - Logger should format messages with metadata', () => {
      // CONTRACT: All logs should include timestamp, level, message, and metadata
      const testMetadata = { userId: '123', action: 'save' }

      Logger.info('Test message', testMetadata)

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[INFO\] \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        'Test message',
        testMetadata
      )
    })

    it('should fail - Logger should handle messages without metadata', () => {
      // CONTRACT: Metadata should be optional
      Logger.warn('Warning message')

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[WARN\] \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        'Warning message'
      )
    })
  })

  describe('Error Logging', () => {
    it('should fail - Logger should handle Error objects properly', () => {
      // CONTRACT: Error objects should be serialized with stack traces
      const testError = new Error('Test error')
      testError.stack = 'Error: Test error\n    at test.js:1:1'

      Logger.error('Error occurred', { error: testError })

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringMatching(/\[ERROR\]/),
        'Error occurred',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error',
            stack: expect.stringContaining('test.js:1:1')
          })
        })
      )
    })
  })

  describe('Production Safety', () => {
    it('should fail - Logger should not log sensitive data in production', () => {
      // CONTRACT: Logger should sanitize sensitive fields in production
      vi.stubEnv('NODE_ENV', 'production')

      const sensitiveData = {
        password: 'secret123',
        token: 'bearer_token',
        email: 'user@example.com',
        safe: 'this is ok'
      }

      Logger.warn('User action', sensitiveData)

      // Should sanitize sensitive fields
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringMatching(/\[WARN\]/),
        'User action',
        expect.objectContaining({
          password: '[REDACTED]',
          token: '[REDACTED]',
          email: 'user@example.com', // Email might be ok to log
          safe: 'this is ok'
        })
      )
    })
  })
})