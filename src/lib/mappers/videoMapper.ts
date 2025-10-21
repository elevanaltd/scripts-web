import type { Tables } from '@elevanaltd/shared-lib/types';

/**
 * Extended type for videos query results with joined scripts data
 * Used when querying videos with script status for navigation color coding
 */
type VideoRowWithScripts = Tables<'videos'> & {
  scripts?: Array<{ status?: string }> | { status?: string };
};

/**
 * Domain model for Video used in UI/State
 * Maps from Supabase Tables<'videos'> with nullability conversions
 * CRITICAL: eav_code is mandatory - videos without eav_code are filtered
 */
export interface Video {
  id: string;
  eav_code: string; // MANDATORY - videos without this are invalid
  title: string;
  main_stream_status?: string; // null → undefined conversion
  vo_stream_status?: string; // null → undefined conversion
  scripts?: Array<{ status?: string }> | { status?: string }; // joined script data for status color coding
}

/**
 * Maps a Supabase video row to domain Video model
 * CRITICAL: Throws error if eav_code is null (business requirement)
 *
 * @param row - Supabase video row from database
 * @returns Domain Video model for UI consumption
 * @throws Error if row is null/undefined or if eav_code is null
 */
export function mapVideoRowToVideo(row: Tables<'videos'>): Video {
  if (!row) {
    throw new Error(`Cannot map ${row === null ? 'null' : 'undefined'} video row`);
  }

  // CRITICAL: Videos without eav_code are invalid in the domain
  if (!row.eav_code) {
    throw new Error(`Video ${row.id} has no eav_code - cannot map to domain model`);
  }

  return {
    id: row.id,
    eav_code: row.eav_code, // Guaranteed non-null by check above
    title: row.title,
    // Convert null to undefined for UI compatibility
    main_stream_status: row.main_stream_status ?? undefined,
    vo_stream_status: row.vo_stream_status ?? undefined,
    // Preserve joined script data for navigation color coding
    scripts: (row as VideoRowWithScripts).scripts
  };
}

/**
 * Maps an array of Supabase video rows to domain Video models
 * Automatically filters out videos without eav_code
 *
 * @param rows - Array of Supabase video rows
 * @returns Array of valid domain Video models (only those with eav_code)
 */
export function mapVideoRowsToVideos(rows: Tables<'videos'>[] | null | undefined): Video[] {
  if (!rows || !Array.isArray(rows)) {
    return [];
  }

  // Filter and map, skipping videos without eav_code
  const validVideos: Video[] = [];

  for (const row of rows) {
    if (row && row.eav_code) {
      try {
        validVideos.push(mapVideoRowToVideo(row));
      } catch {
        // Skip videos that fail mapping (e.g., null eav_code)
        // This is expected behavior for filtering invalid records
      }
    }
  }

  return validVideos;
}

/**
 * Utility function to filter videos that have eav_code
 * Used when you need the raw Supabase rows filtered, not mapped
 *
 * @param videos - Array of Supabase video rows
 * @returns Filtered array with only videos that have eav_code
 */
export function filterVideosWithEavCode(videos: Tables<'videos'>[]): Tables<'videos'>[] {
  return videos.filter(video => video?.eav_code !== null && video?.eav_code !== undefined);
}