/**
 * Realtime Payload Validation - TD-005 Security Remediation
 *
 * CONSTITUTIONAL MANDATE: Zero-trust security principle
 * All realtime events must be validated before cache updates
 *
 * Defense-in-depth validation layers:
 * 1. Payload structure validation (required fields present)
 * 2. Script ID validation (prevent cross-script contamination)
 * 3. Timestamp validation (prevent replay attacks)
 *
 * NOTE: This is client-side validation (defense-in-depth)
 * RLS policies on server remain authoritative security boundary
 */

import { Logger } from '../../services/logger';

/**
 * Realtime payload structure from Supabase
 * Based on documented postgres_changes payload format
 */
export interface RealtimePostgresChangesPayload<T = Record<string, unknown>> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  schema: string;
  table: string;
  commit_timestamp?: string;
  errors: string[] | null;
}

/**
 * Validation context from consuming component
 */
export interface ValidationContext {
  currentScriptId: string;
  currentUserId: string | undefined;
}

/**
 * Security event codes for monitoring
 */
export enum SecurityEventCode {
  MALFORMED_PAYLOAD = 'SEC_001_MALFORMED_PAYLOAD',
  CROSS_SCRIPT_CONTAMINATION = 'SEC_002_CROSS_SCRIPT',
  REPLAY_ATTACK = 'SEC_003_REPLAY_ATTACK',
  MISSING_TIMESTAMP = 'SEC_004_MISSING_TIMESTAMP',
}

/**
 * Validate realtime payload before allowing cache update
 *
 * Returns:
 * - true: Payload is valid, proceed with processing
 * - false: Payload is invalid, reject and log security event
 *
 * Validation Layers:
 * 1. Structure: Required fields present (id, script_id)
 * 2. Script ID: Matches current script (prevent contamination)
 * 3. Timestamp: Within acceptable age (prevent replay)
 */
export function validateRealtimePayload(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  context: ValidationContext
): boolean {
  // Layer 1: Basic payload structure validation
  if (!payload.new?.id || !payload.new?.script_id) {
    Logger.warn('Malformed realtime payload - missing required fields', {
      code: SecurityEventCode.MALFORMED_PAYLOAD,
      eventType: payload.eventType,
      hasNew: !!payload.new,
      hasId: !!payload.new?.id,
      hasScriptId: !!payload.new?.script_id,
      table: payload.table,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  // Layer 2: Script ID validation (prevent cross-script contamination)
  if (payload.new.script_id !== context.currentScriptId) {
    Logger.info('Realtime event for different script - ignored', {
      code: SecurityEventCode.CROSS_SCRIPT_CONTAMINATION,
      expected: context.currentScriptId,
      received: payload.new.script_id,
      eventType: payload.eventType,
      commentId: payload.new.id,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  // Layer 3: Timestamp validation (prevent replay attacks)
  if (payload.commit_timestamp) {
    const eventTimestamp = new Date(payload.commit_timestamp).getTime();
    const now = Date.now();
    const maxAgeMs = 30000; // 30 seconds (reasonable window for network latency)

    if (now - eventTimestamp > maxAgeMs) {
      Logger.warn('Stale realtime event - possible replay attack', {
        code: SecurityEventCode.REPLAY_ATTACK,
        eventType: payload.eventType,
        commentId: payload.new.id,
        scriptId: payload.new.script_id,
        age: now - eventTimestamp,
        maxAge: maxAgeMs,
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  } else {
    // Missing timestamp is suspicious but not blocking
    // (some Supabase events may not include commit_timestamp)
    Logger.info('Realtime event missing timestamp', {
      code: SecurityEventCode.MISSING_TIMESTAMP,
      eventType: payload.eventType,
      commentId: payload.new.id,
      scriptId: payload.new.script_id,
      timestamp: new Date().toISOString(),
    });
  }

  // All validation layers passed
  return true;
}
