import { describe, it, expect } from 'vitest';
import { mapScriptRowToScript, mapScriptComponentRow, normalizeScriptId } from './scriptMapper';
import type { Tables } from '@elevanaltd/shared-lib/types';

describe('scriptMapper', () => {
  describe('normalizeScriptId', () => {
    it('should return valid string IDs unchanged', () => {
      expect(normalizeScriptId('script-123', 'component-1')).toBe('script-123');
      expect(normalizeScriptId('abc', 'comp')).toBe('abc');
    });

    it('should throw error for null script_id', () => {
      expect(() => normalizeScriptId(null, 'component-1'))
        .toThrow('Script component component-1 has no script_id');
    });

    it('should convert undefined to error', () => {
      expect(() => normalizeScriptId(undefined, 'component-2'))
        .toThrow('Script component component-2 has no script_id');
    });
  });

  describe('mapScriptComponentRow', () => {
    it('should transform a valid script component row', () => {
      const component: Tables<'script_components'> = {
        id: 'comp-1',
        script_id: 'script-123',
        component_number: 1,
        content: 'Test content',
        word_count: 10,
        created_at: '2024-01-01T00:00:00Z'
      };

      const result = mapScriptComponentRow(component);

      expect(result).toEqual({
        number: 1,
        content: 'Test content',
        wordCount: 10,
        hash: expect.any(String) // Hash will be generated
      });
    });

    it('should handle null word_count as 0', () => {
      const component: Tables<'script_components'> = {
        id: 'comp-2',
        script_id: 'script-123',
        component_number: 2,
        content: 'No word count',
        word_count: null,
        created_at: null
      };

      const result = mapScriptComponentRow(component);

      expect(result).toEqual({
        number: 2,
        content: 'No word count',
        wordCount: 0,
        hash: expect.any(String)
      });
    });

    it('should generate consistent hash for same content', () => {
      const component1: Tables<'script_components'> = {
        id: 'comp-1',
        script_id: 'script-123',
        component_number: 1,
        content: 'Same content',
        word_count: 2,
        created_at: null
      };

      const component2: Tables<'script_components'> = {
        id: 'comp-2',
        script_id: 'script-456',
        component_number: 5,
        content: 'Same content',
        word_count: 2,
        created_at: null
      };

      const result1 = mapScriptComponentRow(component1);
      const result2 = mapScriptComponentRow(component2);

      expect(result1.hash).toBe(result2.hash);
    });

    it('should generate different hash for different content', () => {
      const component1: Tables<'script_components'> = {
        id: 'comp-1',
        script_id: 'script-123',
        component_number: 1,
        content: 'Content A',
        word_count: 2,
        created_at: null
      };

      const component2: Tables<'script_components'> = {
        id: 'comp-2',
        script_id: 'script-123',
        component_number: 2,
        content: 'Content B',
        word_count: 2,
        created_at: null
      };

      const result1 = mapScriptComponentRow(component1);
      const result2 = mapScriptComponentRow(component2);

      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe('mapScriptRowToScript', () => {
    it('should transform a valid script row with components', () => {
      const scriptRow: Tables<'scripts'> = {
        id: 'script-1',
        video_id: 'video-123',
        yjs_state: 'binary-data',
        plain_text: 'Script text',
        component_count: 2,
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };

      const components = [
        {
          number: 1,
          content: 'Component 1',
          wordCount: 2,
          hash: 'hash1'
        },
        {
          number: 2,
          content: 'Component 2',
          wordCount: 2,
          hash: 'hash2'
        }
      ];

      const result = mapScriptRowToScript(scriptRow, components);

      expect(result).toEqual({
        id: 'script-1',
        video_id: 'video-123',
        yjs_state: null, // String yjs_state converts to null in mapper
        plain_text: 'Script text',
        component_count: 2,
        status: 'draft',
        components,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      });
    });

    it('should throw error when video_id is null', () => {
      const scriptRow: Tables<'scripts'> = {
        id: 'script-2',
        video_id: null,
        yjs_state: null,
        plain_text: null,
        component_count: null,
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };

      expect(() => mapScriptRowToScript(scriptRow, []))
        .toThrow('Script script-2 has no video_id - cannot map to domain model');
    });

    it('should default to empty components array when not provided', () => {
      const scriptRow: Tables<'scripts'> = {
        id: 'script-3',
        video_id: 'video-456',
        yjs_state: null,
        plain_text: 'Empty script',
        component_count: 0,
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };

      const result = mapScriptRowToScript(scriptRow);

      expect(result).toEqual({
        id: 'script-3',
        video_id: 'video-456',
        yjs_state: null,
        plain_text: 'Empty script',
        component_count: 0,
        status: 'draft',
        components: [],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      });
    });

    it('should handle null dates with defaults', () => {
      const scriptRow: Tables<'scripts'> = {
        id: 'script-4',
        video_id: 'video-789',
        yjs_state: null,
        plain_text: null,
        component_count: null,
        status: 'draft',
        created_at: null,
        updated_at: null
      };

      const result = mapScriptRowToScript(scriptRow, []);

      expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO date format
      expect(result.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error if script row is null', () => {
      expect(() => mapScriptRowToScript(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any, // Justification: Testing null coercion requires explicitly untyped null value
        []
      ))
        .toThrow('Cannot map null script row');
    });

    it('should throw error if script row is undefined', () => {
      expect(() => mapScriptRowToScript(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any, // Justification: Testing undefined coercion requires bypassing type safety
        []
      ))
        .toThrow('Cannot map undefined script row');
    });

    it('should handle yjs_state as Uint8Array', () => {
      const binaryData = new Uint8Array([1, 2, 3, 4]);
      const scriptRow: Tables<'scripts'> & { yjs_state: Uint8Array } = {
        id: 'script-5',
        video_id: 'video-999',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yjs_state: binaryData as any, // Justification: Testing binary data requires type coercion
        plain_text: 'Binary script',
        component_count: 0,
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };

      const result = mapScriptRowToScript(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scriptRow as any, // Justification: Testing type guard with mixed input
        []
      );

      expect(result.yjs_state).toBe(binaryData);
    });
  });
});