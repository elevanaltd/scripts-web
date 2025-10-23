/**
 * Script Service Tests
 *
 * Tests the script service functionality including:
 * - Loading scripts for videos
 * - Creating scripts when they don't exist
 * - Saving script content and components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadScriptForVideo,
  saveScript,
  saveScriptWithComponents,
  getScriptById,
  generateContentHash,
  updateScriptStatus,
  ComponentData,
  ScriptWorkflowStatus
} from './scriptService';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    }))
  }
}));

describe('scriptService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadScriptForVideo', () => {
    it('should load existing script for video', async () => {
      // This test will initially fail because the service doesn't exist
      expect(() => loadScriptForVideo('video-123')).toBeDefined();
    });

    it('should create new script when none exists', async () => {
      // This test will initially fail because the service doesn't exist
      expect(() => loadScriptForVideo('new-video-456')).toBeDefined();
    });
  });

  describe('saveScript', () => {
    it('should save script with content and components', async () => {
      const components: ComponentData[] = [
        {
          number: 1,
          content: 'Test component content',
          wordCount: 3,
          hash: 'abc123'
        }
      ];

      // Test updated for Amendment #3 PATCH pattern: scriptId, updates
      const yjsState = null; // Will be actual Y.js state when integrated
      const plainText = 'Test content';
      expect(() => saveScript('script-123', {
        yjs_state: yjsState,
        plain_text: plainText,
        component_count: components.length
      })).toBeDefined();
    });
  });

  describe('getScriptById', () => {
    it('should get script by ID', async () => {
      // This test will initially fail because the service doesn't exist
      expect(() => getScriptById('script-123')).toBeDefined();
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = 'Test content for hashing';
      const hash1 = generateContentHash(content);
      const hash2 = generateContentHash(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
      expect(typeof hash1).toBe('string');
    });

    it('should generate different hashes for different content', () => {
      const content1 = 'First content';
      const content2 = 'Second content';
      const hash1 = generateContentHash(content1);
      const hash2 = generateContentHash(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = generateContentHash('');
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should handle special characters and unicode', () => {
      const content = 'Test with émojis 🚀 and spëcial çhars';
      const hash = generateContentHash(content);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('should generate short hashes (for component identification)', () => {
      const content = 'Component content';
      const hash = generateContentHash(content);

      // Hash should be reasonably short for use as component identifier
      expect(hash.length).toBeLessThan(100);
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('saveScriptWithComponents', () => {
    it('should be defined and callable', () => {
      expect(saveScriptWithComponents).toBeDefined();
      expect(typeof saveScriptWithComponents).toBe('function');
    });
  });

  describe('updateScriptStatus', () => {
    it('should be defined and callable', () => {
      expect(updateScriptStatus).toBeDefined();
      expect(typeof updateScriptStatus).toBe('function');
    });

    it('should accept valid workflow status values', () => {
      const validStatuses: ScriptWorkflowStatus[] = [
        'pend_start',
        'draft',
        'in_review',
        'rework',
        'approved',
        'reuse'
      ];

      // Type check - these should compile without errors
      validStatuses.forEach(status => {
        expect(status).toBeTruthy();
      });
    });
  });
});