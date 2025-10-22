/**
 * Script Service - Handles script operations with Supabase
 *
 * Manages loading and saving scripts for videos, including:
 * - Creating scripts when they don't exist
 * - Loading scripts for specific videos
 * - Saving script content and extracted components
 *
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import { supabase as defaultClient } from '../lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@elevanaltd/shared-lib/types';
import {
  validateVideoId,
  validateScriptId,
  validateScriptContent,
  validateComponentArray,
  ValidationError,
  type ComponentData
} from '../lib/validation';
import { mapScriptRowToScript, mapScriptComponentRow } from '../lib/mappers/scriptMapper';
import type { Json } from '@elevanaltd/shared-lib/types';

// Workflow status enum for scripts
export type ScriptWorkflowStatus = 'pend_start' | 'draft' | 'in_review' | 'rework' | 'approved' | 'reuse';

// Type definitions for scripts matching normalized database schema
export interface Script {
  id: string;
  video_id: string;
  yjs_state?: Uint8Array | null; // BYTEA field for Y.js document state (primary content storage)
  plain_text?: string; // Extracted plain text for search/display
  component_count?: number;
  status?: ScriptWorkflowStatus; // Workflow status (defaults to 'draft')
  components: ComponentData[]; // Loaded from script_components table
  created_at: string;
  updated_at: string;
}

// Critical-Engineer: consulted for Architecture pattern selection (yjs_state as source of truth)

// Re-export ComponentData from validation module for type consistency
export type { ComponentData } from '../lib/validation';


export interface ScriptServiceErrorInterface {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Load script for a specific video
 * Creates a new script if one doesn't exist
 * Loads components from the normalized script_components table
 */
export async function loadScriptForVideo(
  videoId: string,
  userRole?: string | null,
  client: SupabaseClient<Database> = defaultClient
): Promise<Script> {
  try {
    // SECURITY: Validate input before database operation
    const validatedVideoId = validateVideoId(videoId);

    // First, try to find existing script
    // Using maybeSingle() to avoid 406 error when no rows exist
    const { data: existingScript, error: fetchError } = await client
      .from('scripts')
      .select('*')
      .eq('video_id', validatedVideoId)
      .maybeSingle();

    if (fetchError) {
      // Any error here is unexpected since maybeSingle handles no rows gracefully
      throw new ScriptServiceError(`Failed to fetch script: ${fetchError.message}`, fetchError.code);
    }

    // If script exists, load its components and return complete object
    if (existingScript) {
      const { data: components, error: componentsError } = await client
        .from('script_components')
        .select('*')
        .eq('script_id', existingScript.id)
        .order('component_number', { ascending: true });

      if (componentsError) {
        throw new ScriptServiceError(`Failed to load script components: ${componentsError.message}`, componentsError.code);
      }

      // Transform database components to expected format using mapper
      const transformedComponents: ComponentData[] = (components || []).map(mapScriptComponentRow);

      // Map script row to domain model with components
      return mapScriptRowToScript(existingScript, transformedComponents);
    }

    // Check if user has permission to create scripts
    // Per North Star: "Script (Internal): Create/edit scripts and components"
    // Internal team = admin + employee roles
    const isInternal = userRole === 'admin' || userRole === 'employee';

    if (!isInternal) {
      // Return a read-only placeholder for client users (non-internal)

      return {
        id: `readonly-${validatedVideoId}`,
        video_id: validatedVideoId,
        yjs_state: null,
        plain_text: 'This script has not been created yet. Please ask an administrator to create the script for this video.',
        component_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        components: [],
        readonly: true // Flag to indicate this is a placeholder
      } as Script & { readonly: boolean };
    }

    // Create new script for video (Y.js state will be initialized by editor)
    const newScript = {
      video_id: validatedVideoId,
      yjs_state: null, // Will be populated when editor saves
      plain_text: 'Script for Video\n\nStart writing your script here. Each paragraph becomes a component that flows through the production pipeline.',
      component_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Race Condition Fix (2025-10-11): Use UPSERT to silently handle duplicate inserts
    // This prevents 409 Conflict errors when concurrent requests try to create scripts
    // for the same video_id (common during parallel React Query executions)
    //
    // CRITICAL FIX (2025-10-11): Don't chain .select() after UPSERT with ignoreDuplicates
    // When ignoreDuplicates:true and duplicate exists, UPSERT returns 0 rows by design.
    // Chaining .select() on 0 rows causes PostgREST 406 error: "JSON object requested, 0 rows returned"
    // Solution: UPSERT without .select(), then always SELECT after (works whether created or existed)
    const { error: upsertError } = await client
      .from('scripts')
      .upsert(newScript, { onConflict: 'video_id', ignoreDuplicates: true });

    if (upsertError) {
      throw new ScriptServiceError(`Failed to create script: ${upsertError.message}`, upsertError.code);
    }

    // Always SELECT after UPSERT (works whether script was just created or already existed)
    // This eliminates conditional logic and 406 errors from .select() on ignored duplicates
    const { data: script, error: fetchAfterUpsertError } = await client
      .from('scripts')
      .select('*')
      .eq('video_id', validatedVideoId)
      .maybeSingle();

    if (fetchAfterUpsertError) {
      throw new ScriptServiceError(`Failed to fetch script after upsert: ${fetchAfterUpsertError.message}`, fetchAfterUpsertError.code);
    }

    if (!script) {
      throw new ScriptServiceError('Script creation failed: upsert succeeded but script not found');
    }

    // Load components for complete script object
    const { data: components, error: componentsError } = await client
      .from('script_components')
      .select('*')
      .eq('script_id', script.id)
      .order('component_number', { ascending: true });

    if (componentsError) {
      throw new ScriptServiceError(`Failed to load script components: ${componentsError.message}`, componentsError.code);
    }

    const transformedComponents: ComponentData[] = (components || []).map(mapScriptComponentRow);

    // Map script row to domain model with components
    return mapScriptRowToScript(script, transformedComponents);
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error loading script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save script with PATCH pattern for concurrency safety
 *
 * Critical-Engineer: consulted for Architecture pattern selection (PATCH vs full-replacement)
 * Amendment #3: Uses PATCH pattern to prevent data corruption from concurrent saves
 *
 * PATCH pattern ensures:
 * - Only specified fields are updated (no accidental nullification)
 * - Concurrent saves don't overwrite each other's changes
 * - Database handles updated_at timestamp (prevents client clock skew)
 *
 * @param scriptId - UUID of script to update
 * @param updates - Partial script updates (only changed fields)
 * @param client - Supabase client instance (defaults to singleton)
 * @returns Complete updated script with components
 */
export async function saveScript(
  scriptId: string,
  updates: Partial<Omit<Script, 'id' | 'video_id' | 'created_at' | 'updated_at' | 'components'>>,
  client: SupabaseClient<Database> = defaultClient
): Promise<Script> {
  try {
    // SECURITY: Validate script ID before database operation
    const validatedScriptId = validateScriptId(scriptId);

    // Validate provided updates
    const validatedUpdates: Record<string, unknown> = {};

    if ('plain_text' in updates && updates.plain_text !== undefined) {
      validatedUpdates.plain_text = validateScriptContent(updates.plain_text);
    }

    if ('yjs_state' in updates) {
      validatedUpdates.yjs_state = updates.yjs_state; // Binary data, no validation needed
    }

    if ('component_count' in updates && updates.component_count !== undefined) {
      validatedUpdates.component_count = updates.component_count;
    }

    if ('status' in updates && updates.status !== undefined) {
      // Validate status is one of the allowed values
      const validStatuses: ScriptWorkflowStatus[] = ['pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse'];
      if (!validStatuses.includes(updates.status)) {
        throw new ValidationError(`Invalid status: ${updates.status}. Must be one of: ${validStatuses.join(', ')}`);
      }
      validatedUpdates.status = updates.status;
    }

    // PATCH pattern: Only update provided fields
    // Database trigger will handle updated_at timestamp
    const { data: updatedScript, error: scriptError } = await client
      .from('scripts')
      .update(validatedUpdates)
      .eq('id', validatedScriptId)
      .select('*')
      .single();

    if (scriptError) {
      throw new ScriptServiceError(`Failed to save script: ${scriptError.message}`, scriptError.code);
    }

    // Load components for complete script object
    const { data: components, error: componentsError } = await client
      .from('script_components')
      .select('*')
      .eq('script_id', validatedScriptId)
      .order('component_number', { ascending: true });

    if (componentsError) {
      throw new ScriptServiceError(`Failed to load script components: ${componentsError.message}`, componentsError.code);
    }

    // Transform database components to expected format
    const transformedComponents: ComponentData[] = (components || []).map(mapScriptComponentRow);

    // Map script row to domain model with components
    return mapScriptRowToScript(updatedScript, transformedComponents);
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error saving script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save script with components using atomic RPC function
 *
 * Ensures atomic save: all-or-nothing persistence for script + components
 * Uses database trigger with transaction-scoped context variable for write protection
 *
 * @param scriptId - UUID of script to update
 * @param yjsState - Y.js document state (Uint8Array | null)
 * @param plainText - Extracted plain text for search/display
 * @param components - Component array for atomic persistence
 * @param client - Supabase client instance (defaults to singleton)
 * @returns Complete updated script with components
 * @throws ScriptServiceError if RPC fails (no silent fallback - fail-fast)
 */
export async function saveScriptWithComponents(
  scriptId: string,
  yjsState: Uint8Array | null,
  plainText: string,
  components: ComponentData[],
  client: SupabaseClient<Database> = defaultClient
): Promise<Script> {
  try {
    // SECURITY: Validate all inputs before database operation
    const validatedScriptId = validateScriptId(scriptId);
    const validatedPlainText = validateScriptContent(plainText);
    const validatedComponents = validateComponentArray(components);

    // Call atomic RPC function for component persistence
    const { data: rpcData, error: rpcError } = await client
      .rpc('save_script_with_components', {
        p_script_id: validatedScriptId,
        p_yjs_state: yjsState ? Buffer.from(yjsState).toString('base64') : '',
        p_plain_text: validatedPlainText,
        p_components: validatedComponents as unknown as Json
      });

    // FAIL-FAST: RPC errors indicate architectural problems that must be fixed
    // No silent fallback - components MUST be saved atomically or fail visibly
    if (rpcError) {
      throw new ScriptServiceError(
        `Component save failed: ${rpcError.message}`,
        rpcError.code,
        {
          hint: rpcError.hint || 'Components could not be saved. Please try again or contact support.',
          details: rpcError.details
        }
      );
    }

    if (!rpcData || rpcData.length === 0) {
      throw new ScriptServiceError(
        'Component save failed: No data returned from database',
        'PGRST_NO_DATA',
        {
          hint: 'The save operation completed but returned no data. This may indicate a permission issue.'
        }
      );
    }

    // Success - map RPC result to domain model
    const updatedScript = rpcData[0];
    return mapScriptRowToScript(updatedScript, components);
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error saving script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get script by ID with components (utility function)
 */
export async function getScriptById(
  scriptId: string,
  client: SupabaseClient<Database> = defaultClient
): Promise<Script> {
  try {
    // SECURITY: Validate input before database operation
    const validatedScriptId = validateScriptId(scriptId);

    const { data: script, error } = await client
      .from('scripts')
      .select('*')
      .eq('id', validatedScriptId)
      .single();

    if (error) {
      throw new ScriptServiceError(`Failed to fetch script: ${error.message}`, error.code);
    }

    // Load components for the script
    const { data: components, error: componentsError } = await client
      .from('script_components')
      .select('*')
      .eq('script_id', validatedScriptId)
      .order('component_number', { ascending: true });

    if (componentsError) {
      throw new ScriptServiceError(`Failed to load script components: ${componentsError.message}`, componentsError.code);
    }

    // Transform database components to expected format
    const transformedComponents: ComponentData[] = (components || []).map(mapScriptComponentRow);

    // Map script row to domain model with components
    return mapScriptRowToScript(script, transformedComponents);
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error fetching script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Utility function to generate content hash for component tracking
 * Exported for client-side consistency with server-side hash generation
 */
export function generateContentHash(content: string): string {
  // Simple hash function for content tracking
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Note: Plain text extraction moved to client-side editor.getText()
// This ensures consistency between what the editor shows and what we store

/**
 * Update script workflow status
 * Allows any authenticated user to change script status for collaboration
 *
 * Critical-Engineer: consulted for Database security model for client-initiated updates
 * Uses secure RPC function to enforce column-level permissions (RLS cannot restrict to single column)
 */
export async function updateScriptStatus(
  scriptId: string,
  status: ScriptWorkflowStatus,
  client: SupabaseClient<Database> = defaultClient
): Promise<Script> {
  try {
    // SECURITY: Validate inputs before database operation
    const validatedScriptId = validateScriptId(scriptId);

    // Validate status is one of the allowed values
    const validStatuses: ScriptWorkflowStatus[] = ['pend_start', 'draft', 'in_review', 'rework', 'approved', 'reuse'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Call secure RPC function that updates ONLY status column
    // RPC provides column-level security that RLS policies cannot enforce
    const { data: updatedScriptArray, error } = await client
      .rpc('update_script_status', {
        p_script_id: validatedScriptId,
        p_new_status: status
      });

    if (error) {
      // Check for specific permission error from RPC
      if (error.message.includes('Permission denied') || error.code === '42501') {
        throw new ScriptServiceError('Update not permitted for this script', '403');
      }
      if (error.code === 'P0002') {
        throw new ScriptServiceError('Script not found', '404');
      }
      throw new ScriptServiceError(`Failed to update script status: ${error.message}`, error.code);
    }

    // RPC returns array, extract first element
    const updatedScript = updatedScriptArray?.[0];

    if (!updatedScript) {
      throw new ScriptServiceError('Script not found or update not permitted', 'PGRST116');
    }

    // Load components for complete script object
    const { data: components, error: componentsError } = await client
      .from('script_components')
      .select('*')
      .eq('script_id', validatedScriptId)
      .order('component_number', { ascending: true });

    if (componentsError) {
      throw new ScriptServiceError(`Failed to load script components: ${componentsError.message}`, componentsError.code);
    }

    // Transform components to expected format
    const transformedComponents: ComponentData[] = (components || []).map(mapScriptComponentRow);

    // Map script row to domain model with components
    return mapScriptRowToScript(updatedScript, transformedComponents);
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error updating script status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Custom error class for script service operations
 */
class ScriptServiceError extends Error {
  public code?: string;
  public details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ScriptServiceError';
    this.code = code;
    this.details = details;
  }
}