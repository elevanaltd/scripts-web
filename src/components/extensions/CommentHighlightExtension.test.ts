/**
 * CommentHighlightExtension Tests
 *
 * TDD Tests for the TipTap Comment Highlight Mark Extension
 * These tests MUST fail first to demonstrate TDD discipline
 *
 * Based on ADR-003 Google Docs-style commenting system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CommentHighlightExtension } from './CommentHighlightExtension';

describe('CommentHighlightExtension - TDD', () => {
  let editor: Editor;

  beforeEach(() => {
    // This will fail until we create the extension
    editor = new Editor({
      extensions: [
        StarterKit,
        CommentHighlightExtension,
      ],
      content: '<p>This is a test document with some content to highlight.</p>',
    });
  });

  afterEach(() => {
    editor?.destroy();
  });

  describe('Extension Registration', () => {
    it('should register as a mark extension', () => {
      // This will fail - extension doesn't exist yet
      const extension = editor.extensionManager.extensions.find(
        ext => ext.name === 'commentHighlight'
      );

      expect(extension).toBeDefined();
      expect(extension?.type).toBe('mark');
    });

    it('should have the correct name', () => {
      // This will fail - extension doesn't exist yet
      expect(CommentHighlightExtension.name).toBe('commentHighlight');
    });
  });

  describe('Comment Highlighting Commands', () => {
    it('should add comment highlight command', () => {
      // This will fail - extension doesn't exist yet
      const hasAddCommand = editor.commands.addCommentHighlight;
      expect(hasAddCommand).toBeDefined();
      expect(typeof hasAddCommand).toBe('function');
    });

    it('should remove comment highlight command', () => {
      // This will fail - extension doesn't exist yet
      const hasRemoveCommand = editor.commands.removeCommentHighlight;
      expect(hasRemoveCommand).toBeDefined();
      expect(typeof hasRemoveCommand).toBe('function');
    });

    it('should toggle comment highlight command', () => {
      // This will fail - extension doesn't exist yet
      const hasToggleCommand = editor.commands.toggleCommentHighlight;
      expect(hasToggleCommand).toBeDefined();
      expect(typeof hasToggleCommand).toBe('function');
    });
  });

  describe('Mark Application', () => {
    it('should apply comment highlight to selected text', () => {
      // This will fail - extension doesn't exist yet
      const content = 'This is a test document';
      editor.commands.setContent(`<p>${content}</p>`);

      // Select "test document" (positions 10-23)
      editor.commands.setTextSelection({ from: 11, to: 24 });

      const result = editor.commands.addCommentHighlight({
        commentId: 'comment-123',
        commentNumber: 1,
        from: 11,
        to: 24
      });

      expect(result).toBe(true);

      // Check that the mark was applied
      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-123"');
      expect(html).toContain('class="comment-highlight"');
    });

    it('should remove comment highlight by comment ID', () => {
      // This will fail - extension doesn't exist yet
      const content = 'This is a test document';
      editor.commands.setContent(`<p>${content}</p>`);

      // First add a highlight
      editor.commands.setTextSelection({ from: 11, to: 24 });
      editor.commands.addCommentHighlight({
        commentId: 'comment-123',
        commentNumber: 1,
        from: 11,
        to: 24
      });

      // Verify it was added
      let html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-123"');

      // Now remove it
      const result = editor.commands.removeCommentHighlight('comment-123');
      expect(result).toBe(true);

      // Verify it was removed
      html = editor.getHTML();
      expect(html).not.toContain('data-comment-id="comment-123"');
      expect(html).not.toContain('class="comment-highlight"');
    });
  });

  describe('HTML Parsing and Rendering', () => {
    it('should parse comment highlights from HTML', () => {
      // This will fail - extension doesn't exist yet
      const htmlWithHighlight = '<p>This is <mark data-comment-id="comment-123" class="comment-highlight">highlighted text</mark> in a paragraph.</p>';

      editor.commands.setContent(htmlWithHighlight);

      // Check that the comment highlight was parsed correctly
      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-123"');
      expect(html).toContain('class="comment-highlight"');
    });

    it('should render comment highlights as mark elements', () => {
      // This will fail - extension doesn't exist yet
      editor.commands.setContent('<p>Test content</p>');
      editor.commands.setTextSelection({ from: 1, to: 5 });

      editor.commands.addCommentHighlight({
        commentId: 'comment-456',
        commentNumber: 2,
        from: 1,
        to: 5
      });

      const html = editor.getHTML();
      expect(html).toMatch(/<mark[^>]*data-comment-id="comment-456"[^>]*>/);
      expect(html).toContain('class="comment-highlight"');
    });
  });

  describe('Comment ID Management', () => {
    it('should store and retrieve comment ID attributes', () => {
      // This will fail - extension doesn't exist yet
      const testCommentId = 'comment-789';

      editor.commands.setContent('<p>Test content for comment ID</p>');
      editor.commands.setTextSelection({ from: 1, to: 8 });

      editor.commands.addCommentHighlight({
        commentId: testCommentId,
        commentNumber: 3,
        from: 1,
        to: 8
      });

      const html = editor.getHTML();
      expect(html).toContain(`data-comment-id="${testCommentId}"`);
    });

    it('should handle multiple comment highlights with different IDs', () => {
      // This will fail - extension doesn't exist yet
      const content = 'First highlight and second highlight in text';
      editor.commands.setContent(`<p>${content}</p>`);

      // Add first highlight
      editor.commands.setTextSelection({ from: 1, to: 6 }); // "First"
      editor.commands.addCommentHighlight({
        commentId: 'comment-1',
        commentNumber: 1,
        from: 1,
        to: 6
      });

      // Add second highlight
      editor.commands.setTextSelection({ from: 21, to: 27 }); // "second"
      editor.commands.addCommentHighlight({
        commentId: 'comment-2',
        commentNumber: 2,
        from: 21,
        to: 27
      });

      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-1"');
      expect(html).toContain('data-comment-id="comment-2"');

      // Both highlights should be present
      const commentMatches = html.match(/data-comment-id="/g);
      expect(commentMatches).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty selections gracefully', () => {
      // This will fail - extension doesn't exist yet
      editor.commands.setContent('<p>Test content</p>');

      // Try to add highlight to empty selection (same from/to positions)
      const result = editor.commands.addCommentHighlight({
        commentId: 'comment-empty',
        commentNumber: 1,
        from: 5,
        to: 5
      });

      expect(result).toBe(false);
    });

    it('should handle removing non-existent comment IDs gracefully', () => {
      // This will fail - extension doesn't exist yet
      editor.commands.setContent('<p>Test content</p>');

      // Try to remove a comment that doesn't exist
      const result = editor.commands.removeCommentHighlight('non-existent-comment');

      // Should still return true (operation completed without error)
      expect(result).toBe(true);
    });
  });

  describe('Comment Numbering - New Features', () => {
    it('should store and render comment numbers', () => {
      const content = 'This is a test document';
      editor.commands.setContent(`<p>${content}</p>`);

      // Select text and add highlight with number
      editor.commands.setTextSelection({ from: 11, to: 24 });
      const result = editor.commands.addCommentHighlight({
        commentId: 'comment-123',
        commentNumber: 5,
        from: 11,
        to: 24
      });

      expect(result).toBe(true);

      // Check that both comment ID and number are stored
      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-123"');
      expect(html).toContain('data-comment-number="5"');
    });

    it('should load existing highlights from database', () => {
      const highlights = [
        {
          commentId: 'comment-1',
          commentNumber: 1,
          startPosition: 1,
          endPosition: 5
        },
        {
          commentId: 'comment-2',
          commentNumber: 2,
          startPosition: 10,
          endPosition: 15
        }
      ];

      editor.commands.setContent('<p>Test content with highlights</p>');

      const result = editor.commands.loadExistingHighlights(highlights);
      expect(result).toBe(true);

      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-1"');
      expect(html).toContain('data-comment-number="1"');
      expect(html).toContain('data-comment-id="comment-2"');
      expect(html).toContain('data-comment-number="2"');
    });

    it('should handle highlights with positions outside document bounds', () => {
      const highlights = [
        {
          commentId: 'comment-1',
          commentNumber: 1,
          startPosition: 1000, // Beyond document end
          endPosition: 1010
        }
      ];

      editor.commands.setContent('<p>Short content</p>');

      // Should not crash and should return true (operation completed)
      const result = editor.commands.loadExistingHighlights(highlights);
      expect(result).toBe(true);

      // Should not contain the invalid highlight
      const html = editor.getHTML();
      expect(html).not.toContain('data-comment-id="comment-1"');
    });

    it('should parse comment numbers from HTML', () => {
      const htmlWithNumberedHighlight = '<p>This is <mark data-comment-id="comment-123" data-comment-number="3" class="comment-highlight">highlighted text</mark> in a paragraph.</p>';

      editor.commands.setContent(htmlWithNumberedHighlight);

      // Check that both comment ID and number were parsed
      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-123"');
      expect(html).toContain('data-comment-number="3"');
    });

    it('should maintain sequential numbering for multiple highlights', () => {
      const content = 'First highlight and second highlight and third highlight';
      editor.commands.setContent(`<p>${content}</p>`);

      // Add three highlights in sequence
      const highlights = [
        { commentId: 'c1', number: 1, from: 1, to: 6 },
        { commentId: 'c2', number: 2, from: 21, to: 27 },
        { commentId: 'c3', number: 3, from: 43, to: 48 }
      ];

      highlights.forEach(h => {
        editor.commands.setTextSelection({ from: h.from, to: h.to });
        editor.commands.addCommentHighlight({
          commentId: h.commentId,
          commentNumber: h.number,
          from: h.from,
          to: h.to
        });
      });

      const html = editor.getHTML();

      // Check that all numbers are present and in sequence
      expect(html).toContain('data-comment-number="1"');
      expect(html).toContain('data-comment-number="2"');
      expect(html).toContain('data-comment-number="3"');
    });
  });

  describe('Command Interface - Updated Commands', () => {
    it('should have loadExistingHighlights command', () => {
      const hasLoadCommand = editor.commands.loadExistingHighlights;
      expect(hasLoadCommand).toBeDefined();
      expect(typeof hasLoadCommand).toBe('function');
    });

    it('should validate addCommentHighlight command signature includes commentNumber', () => {
      // This test validates that the command expects the new signature
      editor.commands.setContent('<p>Test content</p>');
      editor.commands.setTextSelection({ from: 1, to: 5 });

      // Should work with full signature
      const result = editor.commands.addCommentHighlight({
        commentId: 'test-id',
        commentNumber: 1,
        from: 1,
        to: 5
      });

      expect(result).toBe(true);
    });
  });
});