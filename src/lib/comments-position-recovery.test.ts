/**
 * Position Recovery Tests - Hybrid Content-Based Anchoring
 *
 * Tests for comment position recovery algorithm that prevents comment drift
 * when document content changes.
 *
 * Test Scenarios:
 * 1. Exact text match - comment should relocate to new position
 * 2. Text deleted - comment should be marked as orphaned
 * 3. Multiple matches - comment should use closest match to original position
 * 4. Partial match - comment should mark as uncertain
 * 5. No match - comment should fall back to original position with warning
 */

import { describe, it, expect } from 'vitest';
import {
  recoverCommentPosition,
  findTextInDocument,
  calculateMatchQuality,
} from './comments-position-recovery';

// Mock document content for testing
const ORIGINAL_DOC = 'Hello world. This is a test document. The quick brown fox jumps over the lazy dog.';

describe('Position Recovery - Fresh Comment Detection (Bug Fix)', () => {
  it('should skip position recovery for comments < 10 seconds old', () => {
    const freshComment = {
      id: 'comment-1',
      startPosition: 19,
      endPosition: 23,
      highlighted_text: 'test',
      created_at: new Date().toISOString(), // Fresh comment (just now)
    };

    const result = recoverCommentPosition(freshComment, ORIGINAL_DOC);

    expect(result.status).toBe('fallback');
    expect(result.message).toBe('Fresh comment - using original position');
    expect(result.newStartPosition).toBe(19);
    expect(result.newEndPosition).toBe(23);
  });

  it('should run position recovery for comments >= 10 seconds old', () => {
    const oldDate = new Date();
    oldDate.setSeconds(oldDate.getSeconds() - 11); // 11 seconds ago

    const oldComment = {
      id: 'comment-1',
      startPosition: 0,
      endPosition: 4,
      highlighted_text: 'test',
      created_at: oldDate.toISOString(),
    };

    const result = recoverCommentPosition(oldComment, ORIGINAL_DOC);

    // Should run recovery and relocate to where "test" actually appears (position 23)
    expect(result.status).toBe('relocated');
    expect(result.newStartPosition).toBe(23); // Actual position of "test" in document
  });

  it('should handle missing created_at field gracefully', () => {
    const commentWithoutDate = {
      id: 'comment-1',
      startPosition: 0,
      endPosition: 4,
      highlighted_text: 'test',
      // No created_at field
    };

    const result = recoverCommentPosition(commentWithoutDate, ORIGINAL_DOC);

    // Should proceed with normal recovery logic (not crash)
    expect(result).toBeDefined();
    expect(result.status).toBe('relocated');
    expect(result.newStartPosition).toBe(23); // Relocates to actual position
  });
});

describe('Position Recovery - Text Matching', () => {
  describe('findTextInDocument', () => {
    it('should find exact text match and return new position', () => {
      const highlightedText = 'quick brown fox';
      const result = findTextInDocument(ORIGINAL_DOC, highlightedText, 0);

      expect(result).toEqual({
        found: true,
        startPosition: 42,
        endPosition: 57,
        matchQuality: 'exact'
      });
    });

    it('should return null when text is not found', () => {
      const highlightedText = 'deleted text that does not exist';
      const result = findTextInDocument(ORIGINAL_DOC, highlightedText, 0);

      expect(result).toBeNull();
    });

    it('should find closest match when multiple occurrences exist', () => {
      const docWithDuplicates = 'test one test two test three test four';
      const highlightedText = 'test';
      const originalPosition = 20; // Near "test three"

      const result = findTextInDocument(docWithDuplicates, highlightedText, originalPosition);

      expect(result).toEqual({
        found: true,
        startPosition: 18, // "test three" is closest to position 20
        endPosition: 22,
        matchQuality: 'exact'
      });
    });

    it('should handle case-insensitive matching with warning', () => {
      const highlightedText = 'HELLO WORLD';
      const result = findTextInDocument(ORIGINAL_DOC, highlightedText, 0);

      expect(result).toEqual({
        found: true,
        startPosition: 0,
        endPosition: 11,
        matchQuality: 'case-insensitive'
      });
    });

    it('should handle partial matches with fuzzy matching', () => {
      const highlightedText = 'quik brown fox'; // Typo in original
      const result = findTextInDocument(ORIGINAL_DOC, highlightedText, 40);

      expect(result).toEqual({
        found: true,
        startPosition: 42,
        endPosition: 56,
        matchQuality: 'fuzzy'
      });
    });

    it('should return null for very short text (< 3 chars)', () => {
      const highlightedText = 'ab';
      const result = findTextInDocument(ORIGINAL_DOC, highlightedText, 0);

      expect(result).toBeNull();
    });
  });

  describe('calculateMatchQuality', () => {
    it('should return "exact" for identical strings', () => {
      const quality = calculateMatchQuality('hello world', 'hello world');
      expect(quality).toBe('exact');
    });

    it('should return "case-insensitive" for same text different case', () => {
      const quality = calculateMatchQuality('Hello World', 'hello world');
      expect(quality).toBe('case-insensitive');
    });

    it('should return "fuzzy" for similar but not identical strings', () => {
      const quality = calculateMatchQuality('hello world', 'hello word');
      expect(quality).toBe('fuzzy');
    });

    it('should return "poor" for moderately different strings', () => {
      const quality = calculateMatchQuality('hello world programming', 'hello world today');
      expect(quality).toBe('poor');
    });

    it('should return "none" for very different strings', () => {
      const quality = calculateMatchQuality('hello world', 'goodbye universe');
      expect(quality).toBe('none');
    });
  });

  describe('recoverCommentPosition', () => {
    const mockComment = {
      id: 'test-comment-id',
      scriptId: 'test-script-id',
      userId: 'test-user-id',
      content: 'This is a comment',
      startPosition: 13, // "This is a test" in original doc
      endPosition: 27,
      highlighted_text: 'This is a test',
      parentCommentId: null,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should successfully relocate comment when text matches', () => {
      const newDoc = 'Good morning. Hello world. This is a test document.';
      const result = recoverCommentPosition(mockComment, newDoc);

      expect(result).toEqual({
        status: 'relocated',
        newStartPosition: 27,
        newEndPosition: 41,
        matchQuality: 'exact',
        message: 'Comment successfully relocated to new position'
      });
    });

    it('should mark comment as orphaned when text is deleted', () => {
      const newDoc = 'Hello world. The quick brown fox jumps.';
      const result = recoverCommentPosition(mockComment, newDoc);

      expect(result).toEqual({
        status: 'orphaned',
        newStartPosition: mockComment.startPosition,
        newEndPosition: mockComment.endPosition,
        matchQuality: 'none',
        message: 'Original text not found - comment may be outdated'
      });
    });

    it('should mark as uncertain for fuzzy matches', () => {
      const commentWithTypo = {
        ...mockComment,
        highlighted_text: 'This is a tset', // Typo
      };
      const newDoc = 'Good morning. This is a test document.';

      const result = recoverCommentPosition(commentWithTypo, newDoc);

      expect(result.status).toBe('uncertain');
      expect(result.matchQuality).toBe('fuzzy');
      expect(result.message).toContain('approximate match');
    });

    it('should fall back to original position for backward compatibility', () => {
      const commentWithoutHighlightedText = {
        ...mockComment,
        highlighted_text: '', // Old comment without stored text
      };

      const result = recoverCommentPosition(commentWithoutHighlightedText, ORIGINAL_DOC);

      expect(result).toEqual({
        status: 'fallback',
        newStartPosition: mockComment.startPosition,
        newEndPosition: mockComment.endPosition,
        matchQuality: 'none',
        message: 'Using original position (legacy comment without text)'
      });
    });

    it('should handle position out of document bounds', () => {
      const shortDoc = 'Short';
      const result = recoverCommentPosition(mockComment, shortDoc);

      expect(result.status).toBe('orphaned');
      expect(result.newStartPosition).toBeLessThanOrEqual(shortDoc.length);
      expect(result.newEndPosition).toBeLessThanOrEqual(shortDoc.length);
    });
  });

  describe('Integration: Document Changes Scenarios', () => {
    it('should handle text insertion before comment', () => {
      const comment = {
        id: 'test-1',
        scriptId: 'script-1',
        userId: 'user-1',
        content: 'Comment on "world"',
        startPosition: 6,
        endPosition: 11,
        highlighted_text: 'world',
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newDoc = 'Good morning. Hello world';

      const result = recoverCommentPosition(comment, newDoc);

      expect(result.status).toBe('relocated');
      expect(result.newStartPosition).toBe(20); // 'world' moved forward
      expect(result.newEndPosition).toBe(25);
      expect(result.matchQuality).toBe('exact');
    });

    it('should handle text deletion before comment', () => {
      const comment = {
        id: 'test-2',
        scriptId: 'script-1',
        userId: 'user-1',
        content: 'Comment on "document"',
        startPosition: 27,
        endPosition: 35,
        highlighted_text: 'document',
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newDoc = 'This is a document.'; // "test " deleted

      const result = recoverCommentPosition(comment, newDoc);

      expect(result.status).toBe('relocated');
      expect(result.newStartPosition).toBe(10); // 'document' moved backward
      expect(result.newEndPosition).toBe(18);
    });

    it('should handle multiple comments after content changes', () => {
      const comments = [
        {
          id: 'comment-1',
          scriptId: 'script-1',
          userId: 'user-1',
          content: 'First comment',
          startPosition: 0,
          endPosition: 5,
          highlighted_text: 'Hello',
          parentCommentId: null,
          resolvedAt: null,
          resolvedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'comment-2',
          scriptId: 'script-1',
          userId: 'user-1',
          content: 'Second comment',
          startPosition: 6,
          endPosition: 11,
          highlighted_text: 'world',
          parentCommentId: null,
          resolvedAt: null,
          resolvedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const newDoc = 'Good morning. Hello world.';

      const results = comments.map(comment =>
        recoverCommentPosition(comment, newDoc)
      );

      // Both comments should be successfully relocated
      expect(results[0].status).toBe('relocated');
      expect(results[1].status).toBe('relocated');
      expect(results[0].newStartPosition).toBe(14); // 'Hello'
      expect(results[1].newStartPosition).toBe(20); // 'world'
    });
  });

  describe('Performance: Large Document Handling', () => {
    it('should handle 100+ comments efficiently', () => {
      const largeDoc = 'word '.repeat(1000); // 5000 chars
      const comments = Array.from({ length: 100 }, (_, i) => ({
        id: `comment-${i}`,
        scriptId: 'script-1',
        userId: 'user-1',
        content: `Comment ${i}`,
        startPosition: i * 5,
        endPosition: i * 5 + 4,
        highlighted_text: 'word',
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const startTime = Date.now();
      const results = comments.map(comment =>
        recoverCommentPosition(comment, largeDoc)
      );
      const endTime = Date.now();

      // Should complete in < 100ms
      expect(endTime - startTime).toBeLessThan(100);

      // All should be relocated or have valid status
      results.forEach(result => {
        expect(['relocated', 'orphaned', 'uncertain', 'fallback']).toContain(result.status);
      });
    });
  });
});