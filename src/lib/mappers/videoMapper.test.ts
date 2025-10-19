import { describe, it, expect } from 'vitest';
import { mapVideoRowToVideo, mapVideoRowsToVideos, filterVideosWithEavCode } from './videoMapper';
import type { Tables } from '@elevanaltd/shared-lib/types';

describe('videoMapper', () => {
  describe('mapVideoRowToVideo', () => {
    it('should transform a valid Supabase video row to domain Video', () => {
      const supabaseRow: Tables<'videos'> = {
        id: 'video-1',
        title: 'Test Video',
        eav_code: 'EAV001',
        main_stream_status: 'completed',
        vo_stream_status: 'pending',
        production_type: 'standard',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const result = mapVideoRowToVideo(supabaseRow);

      expect(result).toEqual({
        id: 'video-1',
        eav_code: 'EAV001',
        title: 'Test Video',
        main_stream_status: 'completed',
        vo_stream_status: 'pending'
      });
    });

    it('should throw error when eav_code is null', () => {
      const supabaseRow: Tables<'videos'> = {
        id: 'video-2',
        title: 'Invalid Video',
        eav_code: null,
        main_stream_status: null,
        vo_stream_status: null,
        production_type: null,
        created_at: null,
        updated_at: null
      };

      expect(() => mapVideoRowToVideo(supabaseRow))
        .toThrow('Video video-2 has no eav_code - cannot map to domain model');
    });

    it('should handle null status fields gracefully', () => {
      const supabaseRow: Tables<'videos'> = {
        id: 'video-3',
        title: 'New Video',
        eav_code: 'EAV003',
        main_stream_status: null,
        vo_stream_status: null,
        production_type: null,
        created_at: null,
        updated_at: null
      };

      const result = mapVideoRowToVideo(supabaseRow);

      expect(result).toEqual({
        id: 'video-3',
        eav_code: 'EAV003',
        title: 'New Video',
        main_stream_status: undefined,
        vo_stream_status: undefined
      });
    });

    it('should throw error if video row is null', () => {
      expect(() => mapVideoRowToVideo(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any // Justification: Testing null coercion requires untyped null
      )).toThrow('Cannot map null video row');
    });

    it('should throw error if video row is undefined', () => {
      expect(() => mapVideoRowToVideo(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any // Justification: Testing undefined coercion requires bypassing types
      )).toThrow('Cannot map undefined video row');
    });
  });

  describe('mapVideoRowsToVideos', () => {
    it('should map an array of video rows', () => {
      const supabaseRows: Tables<'videos'>[] = [
        {
          id: 'video-1',
          title: 'Video 1',
          eav_code: 'EAV001',
          main_stream_status: 'completed',
          vo_stream_status: 'pending',
          production_type: null,
          created_at: null,
          updated_at: null
        },
        {
          id: 'video-2',
          title: 'Video 2',
          eav_code: 'EAV002',
          main_stream_status: null,
          vo_stream_status: null,
          production_type: null,
          created_at: null,
          updated_at: null
        }
      ];

      const result = mapVideoRowsToVideos(supabaseRows);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'video-1',
        eav_code: 'EAV001',
        title: 'Video 1',
        main_stream_status: 'completed',
        vo_stream_status: 'pending'
      });
      expect(result[1]).toEqual({
        id: 'video-2',
        eav_code: 'EAV002',
        title: 'Video 2',
        main_stream_status: undefined,
        vo_stream_status: undefined
      });
    });

    it('should skip videos with null eav_code', () => {
      const supabaseRows: Tables<'videos'>[] = [
        {
          id: 'video-1',
          title: 'Valid Video',
          eav_code: 'EAV001',
          main_stream_status: null,
          vo_stream_status: null,
          production_type: null,
          created_at: null,
          updated_at: null
        },
        {
          id: 'video-2',
          title: 'Invalid Video',
          eav_code: null,
          main_stream_status: null,
          vo_stream_status: null,
          production_type: null,
          created_at: null,
          updated_at: null
        },
        {
          id: 'video-3',
          title: 'Another Valid Video',
          eav_code: 'EAV003',
          main_stream_status: null,
          vo_stream_status: null,
          production_type: null,
          created_at: null,
          updated_at: null
        }
      ];

      const result = mapVideoRowsToVideos(supabaseRows);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('video-1');
      expect(result[1].id).toBe('video-3');
    });

    it('should return empty array for empty input', () => {
      const result = mapVideoRowsToVideos([]);
      expect(result).toEqual([]);
    });

    it('should handle null array gracefully', () => {
      const result = mapVideoRowsToVideos(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any // Justification: Testing null array handling requires untyped null
      );
      expect(result).toEqual([]);
    });

    it('should handle undefined array gracefully', () => {
      const result = mapVideoRowsToVideos(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any // Justification: Testing undefined array handling requires bypassing types
      );
      expect(result).toEqual([]);
    });
  });

  describe('filterVideosWithEavCode', () => {
    it('should filter out videos without eav_code', () => {
      const videos: Tables<'videos'>[] = [
        {
          id: 'video-1',
          title: 'Video 1',
          eav_code: 'EAV001',
          main_stream_status: null,
          vo_stream_status: null,
          production_type: null,
          created_at: null,
          updated_at: null
        },
        {
          id: 'video-2',
          title: 'Video 2',
          eav_code: null,
          main_stream_status: null,
          vo_stream_status: null,
          production_type: null,
          created_at: null,
          updated_at: null
        },
        {
          id: 'video-3',
          title: 'Video 3',
          eav_code: 'EAV003',
          main_stream_status: null,
          vo_stream_status: null,
          production_type: null,
          created_at: null,
          updated_at: null
        }
      ];

      const result = filterVideosWithEavCode(videos);

      expect(result).toHaveLength(2);
      expect(result[0].eav_code).toBe('EAV001');
      expect(result[1].eav_code).toBe('EAV003');
    });

    it('should return empty array if all videos lack eav_code', () => {
      const videos: Tables<'videos'>[] = [
        {
          id: 'video-1',
          title: 'Video 1',
          eav_code: null,
          main_stream_status: null,
          vo_stream_status: null,
          production_type: null,
          created_at: null,
          updated_at: null
        }
      ];

      const result = filterVideosWithEavCode(videos);
      expect(result).toEqual([]);
    });
  });
});