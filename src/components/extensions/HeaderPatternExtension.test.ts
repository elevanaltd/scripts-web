/**
 * HeaderPatternExtension Tests
 *
 * TDD RED Phase: These tests define expected behavior
 *
 * Test Strategy:
 * 1. Pattern Detection: [[HEADER]] syntax recognized
 * 2. Visual Rendering: Correct HTML/CSS output
 * 3. Persistence: Plain text survives getText()
 * 4. ElevenLabs Export: stripHeaderMarkers() works
 * 5. Edge Cases: Invalid patterns, nested brackets, etc.
 *
 * Constitutional Compliance:
 * - Line 52 (TDD): Failing tests BEFORE implementation
 * - Line 54 (Tests): Must pass before proceeding
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { HeaderPatternExtension, stripHeaderMarkers, isValidHeaderPattern } from './HeaderPatternExtension';

describe('HeaderPatternExtension', () => {
  let editor: Editor | null = null;

  beforeEach(() => {
    // Create editor with HeaderPatternExtension
    editor = new Editor({
      extensions: [
        StarterKit,
        HeaderPatternExtension,
      ],
      content: '<p>Initial content</p>',
    });
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  describe('Pattern Detection', () => {
    it('should detect [[HEATING]] as valid header pattern', () => {
      expect(isValidHeaderPattern('[[HEATING]]')).toBe(true);
    });

    it('should detect [[KITCHEN APPLIANCES]] with spaces', () => {
      expect(isValidHeaderPattern('[[KITCHEN APPLIANCES]]')).toBe(true);
    });

    it('should detect [[SECTION_1]] with underscores', () => {
      expect(isValidHeaderPattern('[[SECTION_1]]')).toBe(true);
    });

    it('should detect [[ROOM-A]] with hyphens', () => {
      expect(isValidHeaderPattern('[[ROOM-A]]')).toBe(true);
    });

    it('should reject lowercase [[heating]]', () => {
      expect(isValidHeaderPattern('[[heating]]')).toBe(false);
    });

    it('should reject mixed case [[Heating]]', () => {
      expect(isValidHeaderPattern('[[Heating]]')).toBe(false);
    });

    it('should reject single brackets [HEATING]', () => {
      expect(isValidHeaderPattern('[HEATING]')).toBe(false);
    });

    it('should reject no brackets HEATING', () => {
      expect(isValidHeaderPattern('HEATING')).toBe(false);
    });

    it('should reject special characters [[HEATING!]]', () => {
      expect(isValidHeaderPattern('[[HEATING!]]')).toBe(false);
    });

    it('should reject empty brackets [[]]', () => {
      expect(isValidHeaderPattern('[[]]')).toBe(false);
    });
  });

  describe('Text Content Preservation', () => {
    it('should preserve [[HEATING]] in plain text extraction', () => {
      // ARRANGE - Set content with header pattern
      editor!.commands.setContent('<p>[[HEATING]]</p><p>The heating system features...</p>');

      // ACT - Extract plain text (this is what gets saved to DB)
      const plainText = editor!.getText();

      // ASSERT - [[HEATING]] should survive getText()
      expect(plainText).toContain('[[HEATING]]');
      expect(plainText).toContain('The heating system features');
    });

    it('should preserve multiple header patterns', () => {
      // ARRANGE
      const content = `
        <p>[[HEATING]]</p>
        <p>Content about heating...</p>
        <p>[[KITCHEN APPLIANCES]]</p>
        <p>Content about kitchen...</p>
      `;
      editor!.commands.setContent(content);

      // ACT
      const plainText = editor!.getText();

      // ASSERT - Both headers preserved
      expect(plainText).toContain('[[HEATING]]');
      expect(plainText).toContain('[[KITCHEN APPLIANCES]]');
    });

    it('should preserve header pattern after editing adjacent text', () => {
      // ARRANGE - Start with header + content
      editor!.commands.setContent('<p>[[HEATING]]</p><p>Original content</p>');

      // ACT - Edit the content paragraph (not the header)
      const secondParagraphPos = editor!.state.doc.resolve(20); // Approximate
      editor!.commands.setTextSelection({ from: secondParagraphPos.pos, to: secondParagraphPos.pos });
      editor!.commands.insertContent(' EDITED');

      // ASSERT - Header still present
      const plainText = editor!.getText();
      expect(plainText).toContain('[[HEATING]]');
      expect(plainText).toContain('EDITED');
    });
  });

  describe('HTML Rendering', () => {
    it('should render [[HEATING]] with header-pattern class', () => {
      // ARRANGE
      editor!.commands.setContent('<p>[[HEATING]]</p>');

      // ACT - Get HTML output
      const html = editor!.getHTML();

      // ASSERT - Should have header-pattern class for CSS styling
      expect(html).toContain('class="header-pattern"');
      expect(html).toContain('[[HEATING]]');
    });

    it('should wrap only the [[HEADER]] portion, not adjacent text', () => {
      // ARRANGE
      editor!.commands.setContent('<p>[[HEATING]] and other text</p>');

      // ACT
      const html = editor!.getHTML();

      // ASSERT - Only [[HEATING]] wrapped, not the rest
      expect(html).toContain('class="header-pattern"');
      expect(html).toContain('and other text');
    });
  });

  describe('ElevenLabs Export Helper', () => {
    it('should strip [[HEATING]] from plain text', () => {
      // ARRANGE
      const scriptText = '[[HEATING]]\nThe heating system features...';

      // ACT
      const cleanText = stripHeaderMarkers(scriptText);

      // ASSERT - Header removed, content preserved
      expect(cleanText).not.toContain('[[HEATING]]');
      expect(cleanText).toContain('The heating system features');
    });

    it('should strip multiple headers', () => {
      // ARRANGE
      const scriptText = `[[HEATING]]
The heating system...
[[KITCHEN]]
The kitchen features...`;

      // ACT
      const cleanText = stripHeaderMarkers(scriptText);

      // ASSERT - Both headers removed
      expect(cleanText).not.toContain('[[HEATING]]');
      expect(cleanText).not.toContain('[[KITCHEN]]');
      expect(cleanText).toContain('The heating system');
      expect(cleanText).toContain('The kitchen features');
    });

    it('should handle script with no headers', () => {
      // ARRANGE
      const scriptText = 'Just regular content without any headers.';

      // ACT
      const cleanText = stripHeaderMarkers(scriptText);

      // ASSERT - Content unchanged
      expect(cleanText).toBe(scriptText);
    });

    it('should remove trailing newlines after headers', () => {
      // ARRANGE - Header followed by newline
      const scriptText = '[[HEATING]]\nContent starts here';

      // ACT
      const cleanText = stripHeaderMarkers(scriptText);

      // ASSERT - No leading newline before content
      expect(cleanText.trim()).toBe('Content starts here');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      // ARRANGE
      editor!.commands.setContent('');

      // ACT
      const plainText = editor!.getText();

      // ASSERT - No errors, empty string
      expect(plainText).toBe('');
    });

    it('should handle header at start of document', () => {
      // ARRANGE
      editor!.commands.setContent('<p>[[INTRO]]</p><p>First paragraph...</p>');

      // ACT
      const plainText = editor!.getText();

      // ASSERT
      expect(plainText).toContain('[[INTRO]]');
    });

    it('should handle header at end of document', () => {
      // ARRANGE
      editor!.commands.setContent('<p>Last paragraph...</p><p>[[OUTRO]]</p>');

      // ACT
      const plainText = editor!.getText();

      // ASSERT
      expect(plainText).toContain('[[OUTRO]]');
    });

    it('should not double-wrap when content is reloaded', () => {
      // ARRANGE - Save and reload cycle
      editor!.commands.setContent('<p>[[HEATING]]</p><p>Content</p>');
      const firstHTML = editor!.getHTML();

      // ACT - Reload the saved HTML
      editor!.commands.setContent(firstHTML);
      const secondHTML = editor!.getHTML();

      // ASSERT - HTML structure identical (no double-wrapping)
      expect(firstHTML).toBe(secondHTML);
    });

    it('should handle special characters in content (not in header)', () => {
      // ARRANGE
      editor!.commands.setContent('<p>[[HEATING]]</p><p>Cost: $1,200 & up!</p>');

      // ACT
      const plainText = editor!.getText();

      // ASSERT - Special chars preserved in content
      expect(plainText).toContain('$1,200 & up!');
      expect(plainText).toContain('[[HEATING]]');
    });
  });

  describe('Integration with TipTap', () => {
    it('should not interfere with other marks (bold, italic)', () => {
      // ARRANGE - Header + formatted text
      const content = '<p>[[HEATING]]</p><p><strong>Bold text</strong> and <em>italic text</em></p>';
      editor!.commands.setContent(content);

      // ACT
      const html = editor!.getHTML();
      const plainText = editor!.getText();

      // ASSERT - Both header pattern and formatting preserved
      expect(html).toContain('class="header-pattern"');
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
      expect(plainText).toContain('[[HEATING]]');
    });

    it('should survive copy-paste operations', () => {
      // ARRANGE - Set content with header
      editor!.commands.setContent('<p>[[HEATING]]</p><p>Content to copy</p>');

      // ACT - Select all and get text (simulates copy)
      editor!.commands.selectAll();
      const copiedText = editor!.state.doc.textBetween(
        editor!.state.selection.from,
        editor!.state.selection.to,
        '\n'
      );

      // ASSERT - Header pattern in copied text
      expect(copiedText).toContain('[[HEATING]]');
    });
  });
});
