/**
 * Validation Schema Tests - Security Input Validation
 *
 * Tests for Zod schemas that validate all user inputs before database operations
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import { describe, it, expect } from 'vitest';
import {
  validateProjectId,
  validateVideoId,
  validateScriptContent,
  validateComponentData,
  projectIdSchema,
  videoIdSchema,
  scriptContentSchema,
  componentDataSchema
} from './validation';

describe('Input Validation Schemas - Security Boundary', () => {
  describe('UUID Validation', () => {

    it('should reject invalid projectId formats', () => {
      const invalidIds = [
        '',
        'invalid-uuid',
        '123',
        'DROP TABLE projects;',
        '<script>alert("xss")</script>',
        null,
        undefined,
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' // wrong length
      ];

      invalidIds.forEach(id => {
        expect(() => validateProjectId(id as unknown)).toThrow();
        expect(() => projectIdSchema.parse(id)).toThrow();
      });
    });

    it('should accept valid SmartSuite IDs for projectId', () => {
      const validSmartSuiteId = '68aa9add9bedb640d0a3bc0c';
      expect(() => validateProjectId(validSmartSuiteId)).not.toThrow();
      expect(projectIdSchema.parse(validSmartSuiteId)).toBe(validSmartSuiteId);
    });

    it('should accept valid SmartSuite IDs for videoId', () => {
      const validSmartSuiteId = '68b24d4d50188d61ca5d564e';
      expect(() => validateVideoId(validSmartSuiteId)).not.toThrow();
      expect(videoIdSchema.parse(validSmartSuiteId)).toBe(validSmartSuiteId);
    });

    it('should reject invalid videoId formats', () => {
      const invalidIds = [
        '',
        'not-a-uuid',
        '1; DELETE FROM videos;',
        'javascript:alert(1)',
        // Note: all-zeros UUID is technically valid, removing from test
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' // wrong format
      ];

      invalidIds.forEach(id => {
        expect(() => validateVideoId(id as unknown)).toThrow();
        expect(() => videoIdSchema.parse(id)).toThrow();
      });
    });
  });

  describe('Script Content Validation', () => {
    it('should accept valid script content', () => {
      const validContent = '<p>This is a valid script paragraph.</p><p>Second paragraph with <strong>formatting</strong>.</p>';
      expect(() => validateScriptContent(validContent)).not.toThrow();
      expect(scriptContentSchema.parse(validContent)).toBe(validContent);
    });

    it('should reject dangerous script content', () => {
      const dangerousContent = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="data:text/html,<script>alert(1)</script>"></object>',
        '<svg onload="alert(1)"></svg>',
        '<div onclick="alert(1)">Click me</div>'
      ];

      dangerousContent.forEach(content => {
        expect(() => validateScriptContent(content)).toThrow();
      });
    });

    it('should enforce content length limits', () => {
      const tooLongContent = '<p>' + 'x'.repeat(100000) + '</p>'; // 100KB+ content
      expect(() => validateScriptContent(tooLongContent)).toThrow();
    });

    it('should reject null/undefined script content', () => {
      expect(() => validateScriptContent(null as unknown)).toThrow();
      expect(() => validateScriptContent(undefined as unknown)).toThrow();
      expect(() => validateScriptContent('')).toThrow(); // Empty content should fail
    });
  });

  describe('Component Data Validation', () => {
    it('should accept valid component data', () => {
      const validComponent = {
        number: 1,
        content: 'This is component content',
        wordCount: 4,
        hash: 'abc123'
      };

      expect(() => validateComponentData(validComponent)).not.toThrow();
      expect(componentDataSchema.parse(validComponent)).toEqual(validComponent);
    });

    it('should reject invalid component numbers', () => {
      const invalidComponents = [
        { number: 0, content: 'test', wordCount: 1, hash: 'abc' },
        { number: -1, content: 'test', wordCount: 1, hash: 'abc' },
        { number: 1001, content: 'test', wordCount: 1, hash: 'abc' }, // Too high
        { number: '1', content: 'test', wordCount: 1, hash: 'abc' }, // String instead of number
      ];

      invalidComponents.forEach(component => {
        expect(() => validateComponentData(component as unknown)).toThrow();
      });
    });

    it('should reject invalid word counts', () => {
      const invalidComponents = [
        { number: 1, content: 'test', wordCount: -1, hash: 'abc' },
        { number: 1, content: 'test', wordCount: 10001, hash: 'abc' }, // Too high
        { number: 1, content: 'test', wordCount: '5', hash: 'abc' }, // String
      ];

      invalidComponents.forEach(component => {
        expect(() => validateComponentData(component as unknown)).toThrow();
      });
    });

    it('should reject malicious component content', () => {
      const maliciousComponent = {
        number: 1,
        content: '<script>steal_data()</script>',
        wordCount: 1,
        hash: 'evil'
      };

      expect(() => validateComponentData(maliciousComponent)).toThrow();
    });
  });

  describe('Batch Validation', () => {
    it('should validate arrays of components', () => {
      const validComponents = [
        { number: 1, content: 'First component', wordCount: 2, hash: 'hash1' },
        { number: 2, content: 'Second component', wordCount: 2, hash: 'hash2' }
      ];

      expect(() => {
        validComponents.forEach(validateComponentData);
      }).not.toThrow();
    });

    it('should reject if any component in batch is invalid', () => {
      const mixedComponents = [
        { number: 1, content: 'Valid component', wordCount: 2, hash: 'hash1' },
        { number: 2, content: '<script>alert(1)</script>', wordCount: 1, hash: 'evil' }
      ];

      expect(() => {
        mixedComponents.forEach(validateComponentData);
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in valid content', () => {
      const specialContent = '<p>Content with émojis 🎉 and spëcial çharacters!</p>';
      expect(() => validateScriptContent(specialContent)).not.toThrow();
    });

    it('should reject extremely long hash values', () => {
      const componentWithLongHash = {
        number: 1,
        content: 'test',
        wordCount: 1,
        hash: 'x'.repeat(1000) // Extremely long hash
      };

      expect(() => validateComponentData(componentWithLongHash)).toThrow();
    });
  });
});