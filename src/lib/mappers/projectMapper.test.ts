import { describe, it, expect } from 'vitest';
import { mapProjectRowToProject, mapProjectRowsToProjects } from './projectMapper';
import type { Tables } from '@elevanaltd/shared-lib/types';

describe('projectMapper', () => {
  describe('mapProjectRowToProject', () => {
    it('should transform a valid Supabase project row to domain Project', () => {
      const supabaseRow: Tables<'projects'> = {
        id: 'proj-1',
        title: 'Test Project',
        eav_code: 'EAV001',
        due_date: '2024-12-31',
        project_phase: 'production',
        client_filter: 'CLIENT001',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        final_invoice_sent: null
      };

      const result = mapProjectRowToProject(supabaseRow);

      expect(result).toEqual({
        id: 'proj-1',
        title: 'Test Project',
        eav_code: 'EAV001',
        due_date: '2024-12-31',
        project_phase: 'production'
      });
    });

    it('should handle null due_date by converting to undefined', () => {
      const supabaseRow: Tables<'projects'> = {
        id: 'proj-2',
        title: 'No Deadline Project',
        eav_code: 'EAV002',
        due_date: null,
        project_phase: null,
        client_filter: null,
        created_at: null,
        updated_at: null,
        final_invoice_sent: null
      };

      const result = mapProjectRowToProject(supabaseRow);

      expect(result).toEqual({
        id: 'proj-2',
        title: 'No Deadline Project',
        eav_code: 'EAV002',
        due_date: undefined,
        project_phase: null
      });
    });

    it('should preserve project_phase as null when null in database', () => {
      const supabaseRow: Tables<'projects'> = {
        id: 'proj-3',
        title: 'Early Stage Project',
        eav_code: 'EAV003',
        due_date: '2024-06-30',
        project_phase: null,
        client_filter: null,
        created_at: null,
        updated_at: null,
        final_invoice_sent: null
      };

      const result = mapProjectRowToProject(supabaseRow);

      expect(result).toEqual({
        id: 'proj-3',
        title: 'Early Stage Project',
        eav_code: 'EAV003',
        due_date: '2024-06-30',
        project_phase: null
      });
    });

    it('should throw error if project row is null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => mapProjectRowToProject(null as any)).toThrow('Cannot map null project row');
    });

    it('should throw error if project row is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => mapProjectRowToProject(undefined as any)).toThrow('Cannot map undefined project row');
    });
  });

  describe('mapProjectRowsToProjects', () => {
    it('should map an array of project rows', () => {
      const supabaseRows: Tables<'projects'>[] = [
        {
          id: 'proj-1',
          title: 'Project 1',
          eav_code: 'EAV001',
          due_date: '2024-12-31',
          project_phase: 'production',
          client_filter: null,
          created_at: null,
          updated_at: null,
          final_invoice_sent: null
        },
        {
          id: 'proj-2',
          title: 'Project 2',
          eav_code: 'EAV002',
          due_date: null,
          project_phase: null,
          client_filter: null,
          created_at: null,
          updated_at: null,
          final_invoice_sent: null
        }
      ];

      const result = mapProjectRowsToProjects(supabaseRows);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'proj-1',
        title: 'Project 1',
        eav_code: 'EAV001',
        due_date: '2024-12-31',
        project_phase: 'production'
      });
      expect(result[1]).toEqual({
        id: 'proj-2',
        title: 'Project 2',
        eav_code: 'EAV002',
        due_date: undefined,
        project_phase: null
      });
    });

    it('should return empty array for empty input', () => {
      const result = mapProjectRowsToProjects([]);
      expect(result).toEqual([]);
    });

    it('should handle null array gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = mapProjectRowsToProjects(null as any);
      expect(result).toEqual([]);
    });

    it('should handle undefined array gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = mapProjectRowsToProjects(undefined as any);
      expect(result).toEqual([]);
    });

    it('should skip null items in array', () => {
      const supabaseRows = [
        {
          id: 'proj-1',
          title: 'Valid Project',
          eav_code: 'EAV001',
          due_date: '2024-12-31',
          project_phase: null,
          client_filter: null,
          created_at: null,
          updated_at: null,
          final_invoice_sent: null
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any
      ];

      const result = mapProjectRowsToProjects(supabaseRows);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('proj-1');
    });
  });
});