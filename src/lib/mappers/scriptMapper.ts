import type { Tables } from '@elevanaltd/shared-lib/types';
import type { ComponentData } from '../../lib/validation';
import type { Script, ScriptWorkflowStatus } from '../../services/scriptService';

/**
 * Generates a consistent hash for content
 * Used for component change detection
 * Browser-compatible implementation using Web Crypto API fallback to simple hash
 *
 * @param content - Text content to hash
 * @returns Hash string of the content
 */
function generateContentHash(content: string): string {
  // Simple browser-compatible hash function
  // This provides consistent hashing for change detection
  // Not cryptographically secure but sufficient for content comparison
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Normalizes a script_id field
 * Converts null/undefined to error (script components must have script_id)
 *
 * @param scriptId - Script ID from database (nullable)
 * @param componentId - Component ID for error reporting
 * @returns Non-null script ID
 * @throws Error if script_id is null/undefined
 */
export function normalizeScriptId(
  scriptId: string | null | undefined,
  componentId: string
): string {
  if (!scriptId) {
    throw new Error(`Script component ${componentId} has no script_id`);
  }
  return scriptId;
}

/**
 * Maps a Supabase script component row to domain ComponentData model
 *
 * @param row - Supabase script component row
 * @returns Domain ComponentData model
 */
export function mapScriptComponentRow(row: Tables<'script_components'>): ComponentData {
  return {
    number: row.component_number,
    content: row.content,
    wordCount: row.word_count ?? 0,
    hash: generateContentHash(row.content)
  };
}

/**
 * Maps a Supabase script row to domain Script model
 * CRITICAL: Throws error if video_id is null (business requirement)
 *
 * @param row - Supabase script row from database
 * @param components - Optional array of ComponentData (already mapped)
 * @returns Domain Script model for service consumption
 * @throws Error if row is null/undefined or if video_id is null
 */
export function mapScriptRowToScript(
  row: Tables<'scripts'>,
  components: ComponentData[] = []
): Script {
  if (!row) {
    throw new Error(`Cannot map ${row === null ? 'null' : 'undefined'} script row`);
  }

  // CRITICAL: Scripts without video_id are invalid in the domain
  if (!row.video_id) {
    throw new Error(`Script ${row.id} has no video_id - cannot map to domain model`);
  }

  // Convert string yjs_state from DB to Uint8Array if needed
  let yjsState: Uint8Array | null | undefined = null;
  if (row.yjs_state) {
    // Check if it's already a Uint8Array by checking for buffer-like properties
    const state = row.yjs_state as unknown;
    if (state && typeof state === 'object' && state.constructor?.name === 'Uint8Array') {
      yjsState = state as Uint8Array;
    } else if (typeof row.yjs_state === 'string') {
      // Convert base64 string to Uint8Array if needed
      // For now, keep as null since we don't have conversion logic
      yjsState = null;
    }
  }

  return {
    id: row.id,
    video_id: row.video_id, // Guaranteed non-null by check above
    yjs_state: yjsState,
    plain_text: row.plain_text ?? undefined,
    component_count: row.component_count ?? undefined,
    status: row.status as ScriptWorkflowStatus | undefined,
    components,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString()
  };
}