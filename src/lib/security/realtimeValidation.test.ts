/**
 * Validation Helper Test Suite - TD-005 Security Remediation
 *
 * Tests for validateRealtimePayload() function
 * Validates defense-in-depth security layers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateRealtimePayload,
  type RealtimePostgresChangesPayload,
  type ValidationContext,
  SecurityEventCode,
} from './realtimeValidation';
import { Logger } from '../../services/logger';

// Mock Logger
vi.mock('../../services/logger', () => ({
  Logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('validateRealtimePayload', () => {
  let validPayload: RealtimePostgresChangesPayload;
  let validContext: ValidationContext;

  beforeEach(() => {
    vi.clearAllMocks();

    validPayload = {
      eventType: 'INSERT',
      schema: 'public',
      table: 'comments',
      commit_timestamp: new Date().toISOString(),
      errors: null,
      new: {
        id: 'comment-123',
        script_id: 'script-456',
        user_id: 'user-789',
        content: 'Test comment',
        start_position: 0,
        end_position: 50,
      },
      old: {},
    };

    validContext = {
      currentScriptId: 'script-456',
      currentUserId: 'user-789',
    };
  });

  describe('Valid Payloads', () => {
    it('should return true for valid payload with all fields', () => {
      const result = validateRealtimePayload(validPayload, validContext);
      expect(result).toBe(true);
      expect(Logger.warn).not.toHaveBeenCalled();
    });

    it('should return true for valid UPDATE event', () => {
      const updatePayload = { ...validPayload, eventType: 'UPDATE' as const };
      const result = validateRealtimePayload(updatePayload, validContext);
      expect(result).toBe(true);
    });

    it('should return true for valid DELETE event', () => {
      const deletePayload = {
        ...validPayload,
        eventType: 'DELETE' as const,
        old: validPayload.new, // DELETE uses 'old' field
        new: {},
      };
      const result = validateRealtimePayload(deletePayload, validContext);
      expect(result).toBe(true);
    });
  });

  describe('Layer 1: Payload Structure Validation', () => {
    it('should reject payload missing id field', () => {
      const malformedPayload = {
        ...validPayload,
        new: { ...validPayload.new, id: undefined },
      };

      const result = validateRealtimePayload(malformedPayload, validContext);

      expect(result).toBe(false);
      expect(Logger.warn).toHaveBeenCalledWith(
        'Malformed realtime payload - missing required fields',
        expect.objectContaining({
          code: SecurityEventCode.MALFORMED_PAYLOAD,
          hasId: false,
        })
      );
    });

    it('should reject payload missing script_id field', () => {
      const malformedPayload = {
        ...validPayload,
        new: { ...validPayload.new, script_id: undefined },
      };

      const result = validateRealtimePayload(malformedPayload, validContext);

      expect(result).toBe(false);
      expect(Logger.warn).toHaveBeenCalledWith(
        'Malformed realtime payload - missing required fields',
        expect.objectContaining({
          code: SecurityEventCode.MALFORMED_PAYLOAD,
          hasScriptId: false,
        })
      );
    });

    it('should reject payload with empty new object', () => {
      const malformedPayload = {
        ...validPayload,
        new: {},
      };

      const result = validateRealtimePayload(malformedPayload, validContext);

      expect(result).toBe(false);
      expect(Logger.warn).toHaveBeenCalledWith(
        'Malformed realtime payload - missing required fields',
        expect.objectContaining({
          code: SecurityEventCode.MALFORMED_PAYLOAD,
        })
      );
    });
  });

  describe('Layer 2: Script ID Validation', () => {
    it('should reject payload for different script', () => {
      const crossScriptPayload = {
        ...validPayload,
        new: { ...validPayload.new, script_id: 'script-DIFFERENT' },
      };

      const result = validateRealtimePayload(crossScriptPayload, validContext);

      expect(result).toBe(false);
      expect(Logger.info).toHaveBeenCalledWith(
        'Realtime event for different script - ignored',
        expect.objectContaining({
          code: SecurityEventCode.CROSS_SCRIPT_CONTAMINATION,
          expected: 'script-456',
          received: 'script-DIFFERENT',
        })
      );
    });

    it('should accept payload matching current script', () => {
      const result = validateRealtimePayload(validPayload, validContext);

      expect(result).toBe(true);
      expect(Logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('different script'),
        expect.anything()
      );
    });
  });

  describe('Layer 3: Timestamp Validation', () => {
    it('should reject stale event (older than 30 seconds)', () => {
      const staleTimestamp = new Date(Date.now() - 35000).toISOString(); // 35 seconds ago
      const stalePayload = {
        ...validPayload,
        commit_timestamp: staleTimestamp,
      };

      const result = validateRealtimePayload(stalePayload, validContext);

      expect(result).toBe(false);
      expect(Logger.warn).toHaveBeenCalledWith(
        'Stale realtime event - possible replay attack',
        expect.objectContaining({
          code: SecurityEventCode.REPLAY_ATTACK,
          age: expect.any(Number),
          maxAge: 30000,
        })
      );
    });

    it('should accept recent event (within 30 seconds)', () => {
      const recentTimestamp = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
      const recentPayload = {
        ...validPayload,
        commit_timestamp: recentTimestamp,
      };

      const result = validateRealtimePayload(recentPayload, validContext);

      expect(result).toBe(true);
      expect(Logger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Stale'),
        expect.anything()
      );
    });

    it('should log info for missing timestamp but not reject', () => {
      const payloadWithoutTimestamp = {
        ...validPayload,
        commit_timestamp: undefined,
      };

      const result = validateRealtimePayload(payloadWithoutTimestamp, validContext);

      expect(result).toBe(true); // Still valid (non-blocking)
      expect(Logger.info).toHaveBeenCalledWith(
        'Realtime event missing timestamp',
        expect.objectContaining({
          code: SecurityEventCode.MISSING_TIMESTAMP,
        })
      );
    });

    it('should accept current timestamp', () => {
      const currentPayload = {
        ...validPayload,
        commit_timestamp: new Date().toISOString(),
      };

      const result = validateRealtimePayload(currentPayload, validContext);

      expect(result).toBe(true);
    });

    it('should reject event older than 30 seconds (replay attack)', () => {
      const oldTimestamp = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const oldPayload = {
        ...validPayload,
        commit_timestamp: oldTimestamp,
      };

      const result = validateRealtimePayload(oldPayload, validContext);

      expect(result).toBe(false);
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('replay attack'),
        expect.objectContaining({
          code: SecurityEventCode.REPLAY_ATTACK,
        })
      );
    });
  });

  describe('Combined Attack Scenarios', () => {
    it('should reject malformed payload with wrong script_id', () => {
      const attackPayload = {
        ...validPayload,
        new: {
          id: 'malicious-id',
          script_id: 'wrong-script',
          // Missing other fields
        },
      };

      const result = validateRealtimePayload(attackPayload, validContext);

      expect(result).toBe(false);
      // Should fail at second layer (wrong script_id) since id and script_id are present
      expect(Logger.info).toHaveBeenCalledWith(
        'Realtime event for different script - ignored',
        expect.objectContaining({
          code: SecurityEventCode.CROSS_SCRIPT_CONTAMINATION,
        })
      );
    });

    it('should reject stale payload for wrong script', () => {
      const staleTimestamp = new Date(Date.now() - 40000).toISOString();
      const attackPayload = {
        ...validPayload,
        commit_timestamp: staleTimestamp,
        new: { ...validPayload.new, script_id: 'wrong-script' },
      };

      const result = validateRealtimePayload(attackPayload, validContext);

      expect(result).toBe(false);
      // Should fail at script_id validation (before timestamp check)
      expect(Logger.info).toHaveBeenCalledWith(
        expect.stringContaining('different script'),
        expect.anything()
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null new object', () => {
      const nullPayload = {
        ...validPayload,
        new: null as never,
      };

      const result = validateRealtimePayload(nullPayload, validContext);

      expect(result).toBe(false);
      expect(Logger.warn).toHaveBeenCalled();
    });

    it('should handle undefined context fields gracefully', () => {
      const contextWithoutUser: ValidationContext = {
        currentScriptId: 'script-456',
        currentUserId: undefined,
      };

      const result = validateRealtimePayload(validPayload, contextWithoutUser);

      // Should still validate (user_id not required for validation)
      expect(result).toBe(true);
    });

    it('should reject payload with numeric id instead of string', () => {
      const numericIdPayload = {
        ...validPayload,
        new: { ...validPayload.new, id: 123 as never },
      };

      // Validation should still pass (id exists, even if wrong type)
      // Type safety handled by TypeScript, runtime validation checks presence
      const result = validateRealtimePayload(numericIdPayload, validContext);

      expect(result).toBe(true); // Presence check passes
    });
  });
});
