import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smartSuiteData } from './smartsuite-data';
import { supabase } from './supabase';
// Simple test file using any types for mocks
/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock Supabase client
vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn()
    }
  }
}));

describe('SmartSuiteData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchProjects', () => {
    it('should fetch projects from Supabase', async () => {
      const mockProjects = [
        { id: '1', title: 'Project 1', eav_code: 'EAV001' },
        { id: '2', title: 'Project 2', eav_code: 'EAV002' }
      ];

      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockProjects,
          error: null
        })
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock
      } as any);

      const result = await smartSuiteData.fetchProjects();

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockProjects);
    });

    it('should throw error when fetch fails', async () => {
      const mockError = { message: 'Database error' };

      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: mockError
        })
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock
      } as any);

      await expect(smartSuiteData.fetchProjects()).rejects.toThrow(
        'Failed to fetch projects: Database error'
      );
    });
  });

  describe('fetchVideosForProject', () => {
    it('should fetch videos for a specific project', async () => {
      const projectEavCode = 'EAV001';
      const mockVideos = [
        { id: 'v1', title: 'Video 1', eav_code: projectEavCode },
        { id: 'v2', title: 'Video 2', eav_code: projectEavCode }
      ];

      const orderMock = vi.fn().mockResolvedValue({
        data: mockVideos,
        error: null
      });

      const eqMock = vi.fn().mockReturnValue({
        order: orderMock
      });

      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock
      } as any);

      const result = await smartSuiteData.fetchVideosForProject(projectEavCode);

      expect(supabase.from).toHaveBeenCalledWith('videos');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(eqMock).toHaveBeenCalledWith('eav_code', projectEavCode);
      expect(result).toEqual(mockVideos);
    });
  });

  describe('triggerManualSync', () => {
    it('should trigger manual sync successfully', async () => {
      const mockSession = {
        data: {
          session: {
            access_token: 'mock-token'
          }
        }
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: 'Synced 10 projects'
        })
      });

      const result = await smartSuiteData.triggerManualSync();

      expect(result).toEqual({
        success: true,
        message: 'Synced 10 projects'
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/sync-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      });
    });

    it('should handle sync failure', async () => {
      const mockSession = {
        data: {
          session: {
            access_token: 'mock-token'
          }
        }
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue(mockSession as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: 'API rate limit exceeded'
        })
      });

      const result = await smartSuiteData.triggerManualSync();

      expect(result).toEqual({
        success: false,
        message: 'API rate limit exceeded'
      });
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status from metadata table', async () => {
      const mockMetadata = {
        last_sync_completed_at: '2025-09-26T12:00:00Z',
        status: 'idle',
        last_error: null
      };

      const singleMock = vi.fn().mockResolvedValue({
        data: mockMetadata,
        error: null
      });

      const selectMock = vi.fn().mockReturnValue({
        single: singleMock
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock
      } as any);

      const result = await smartSuiteData.getSyncStatus();

      expect(result).toEqual({
        lastSync: '2025-09-26T12:00:00Z',
        status: 'idle',
        error: null  // The implementation returns error field from data
      });
    });

    it('should return default status when no metadata exists', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'No rows found' }
      });

      const selectMock = vi.fn().mockReturnValue({
        single: singleMock
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock
      } as any);

      const result = await smartSuiteData.getSyncStatus();

      expect(result).toEqual({
        lastSync: null,
        status: 'idle'
      });
    });
  });
});