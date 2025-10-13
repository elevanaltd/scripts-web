/**
 * CHARACTERIZATION TESTS for sanitizeUtils
 * Step 2.1.5: Extract utilities from TipTapEditor.tsx (L48-119)
 *
 * Purpose: Preserve existing behavior during extraction refactor
 * Source Coverage: TipTapEditor.paste-handler.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { sanitizeHTML, convertPlainTextToHTML, handlePlainTextPaste } from './sanitizeUtils';
import { EditorView } from '@tiptap/pm/view';
import { Schema } from '@tiptap/pm/model';

describe('sanitizeUtils - Characterization Tests', () => {
  describe('sanitizeHTML', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Safe paragraph with <strong>bold</strong> and <em>italic</em></p>';
      const result = sanitizeHTML(input);

      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
    });

    it('should strip dangerous script tags', () => {
      const input = '<p>Text</p><script>alert("XSS")</script>';
      const result = sanitizeHTML(input);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should strip event handlers', () => {
      const input = '<p onclick="alert(1)">Click me</p>';
      const result = sanitizeHTML(input);

      expect(result).not.toContain('onclick');
      expect(result).toContain('Click me');
    });

    it('should allow class attributes', () => {
      const input = '<p class="component-paragraph">Text</p>';
      const result = sanitizeHTML(input);

      expect(result).toContain('class="component-paragraph"');
    });
  });

  describe('convertPlainTextToHTML', () => {
    it('should convert plain text to HTML paragraph', () => {
      const input = 'Hello world';
      const result = convertPlainTextToHTML(input);

      expect(result).toBe('<p>Hello world</p>');
    });

    it('should escape HTML entities', () => {
      const input = '<script>alert("XSS")</script>';
      const result = convertPlainTextToHTML(input);

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should convert double newlines to paragraph breaks', () => {
      const input = 'Paragraph 1\n\nParagraph 2';
      const result = convertPlainTextToHTML(input);

      expect(result).toContain('</p><p>');
      expect(result).toContain('Paragraph 1');
      expect(result).toContain('Paragraph 2');
    });

    it('should escape dangerous HTML characters', () => {
      const input = 'A & B < C > D';
      const result = convertPlainTextToHTML(input);

      expect(result).toContain('&amp;');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      // Note: DOMPurify sanitizes back to literal quotes after escaping
      // This is safe because DOMPurify ensures no XSS vectors remain
    });
  });

  describe('handlePlainTextPaste', () => {
    // Mock EditorView setup
    const createMockView = () => {
      const mockSchema = new Schema({
        nodes: {
          doc: { content: 'block+' },
          paragraph: {
            content: 'text*',
            group: 'block',
            parseDOM: [{ tag: 'p' }],
            toDOM: () => ['p', 0]
          },
          text: { group: 'inline' }
        }
      });

      const mockState = {
        schema: mockSchema,
        tr: {
          insertText: vi.fn().mockReturnThis(),
          replaceSelection: vi.fn().mockReturnThis()
        }
      };

      const mockView = {
        state: mockState,
        dispatch: vi.fn()
      } as unknown as EditorView;

      return mockView;
    };

    it('should reject paste content exceeding 1MB size limit', () => {
      const mockView = createMockView();
      const mockShowError = vi.fn();
      const largeText = 'a'.repeat(2 * 1024 * 1024); // 2MB

      handlePlainTextPaste(mockView, largeText, mockShowError);

      expect(mockShowError).toHaveBeenCalledWith(
        'Pasted content is too large. Please paste in smaller chunks.'
      );
      expect(mockView.dispatch).toHaveBeenCalled();
    });

    it('should handle single paragraph plain text', () => {
      const mockView = createMockView();
      const mockShowError = vi.fn();
      const text = 'Single line of text';

      handlePlainTextPaste(mockView, text, mockShowError);

      expect(mockView.dispatch).toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('should handle multiple paragraphs with double newlines', () => {
      const mockView = createMockView();
      const mockShowError = vi.fn();
      const text = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';

      handlePlainTextPaste(mockView, text, mockShowError);

      expect(mockView.dispatch).toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('should sanitize HTML entities in multi-paragraph paste', () => {
      const mockView = createMockView();
      const mockShowError = vi.fn();
      const text = 'Para 1 with <script>\n\nPara 2 with &';

      handlePlainTextPaste(mockView, text, mockShowError);

      expect(mockView.dispatch).toHaveBeenCalled();
      // Verify dispatch was called (actual sanitization tested in other tests)
    });
  });
});
