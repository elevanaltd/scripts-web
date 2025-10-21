import type { Tables } from '@elevanaltd/shared-lib/types';

/**
 * Domain model for Project used in UI/State
 * Maps from Supabase Tables<'projects'> with nullability conversions
 */
export interface Project {
  id: string;
  title: string;
  eav_code: string;
  due_date?: string; // null → undefined conversion for UI compatibility
  project_phase?: string | null;
}

/**
 * Maps a Supabase project row to domain Project model
 * Converts null due_date to undefined for UI state compatibility
 *
 * @param row - Supabase project row from database
 * @returns Domain Project model for UI consumption
 * @throws Error if row is null/undefined
 */
export function mapProjectRowToProject(row: Tables<'projects'>): Project {
  if (!row) {
    throw new Error(`Cannot map ${row === null ? 'null' : 'undefined'} project row`);
  }

  return {
    id: row.id,
    title: row.title,
    eav_code: row.eav_code,
    // Convert null to undefined for UI compatibility (null !== undefined in TypeScript)
    due_date: row.due_date ?? undefined,
    project_phase: row.project_phase
  };
}

/**
 * Maps an array of Supabase project rows to domain Project models
 * Filters out null/undefined entries gracefully
 *
 * @param rows - Array of Supabase project rows
 * @returns Array of domain Project models
 */
export function mapProjectRowsToProjects(rows: Tables<'projects'>[] | null | undefined): Project[] {
  if (!rows || !Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row): row is Tables<'projects'> => row !== null && row !== undefined)
    .map(mapProjectRowToProject);
}