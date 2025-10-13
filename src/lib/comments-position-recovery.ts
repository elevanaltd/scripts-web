/**
 * Comment Position Recovery - Hybrid Content-Based Anchoring
 *
 * Implements intelligent position recovery to prevent comment drift when
 * document content changes.
 *
 * Strategy:
 * 1. Store highlighted text when creating comments
 * 2. On load, search for text in document
 * 3. Update positions if text found at different location
 * 4. Mark as orphaned if text not found
 * 5. Fall back to original position for legacy comments
 */

export type MatchQuality = 'exact' | 'case-insensitive' | 'fuzzy' | 'poor' | 'none';

export type RecoveryStatus = 'relocated' | 'orphaned' | 'uncertain' | 'fallback';

export interface TextMatchResult {
  found: boolean;
  startPosition: number;
  endPosition: number;
  matchQuality: MatchQuality;
}

export interface PositionRecoveryResult {
  status: RecoveryStatus;
  newStartPosition: number;
  newEndPosition: number;
  matchQuality: MatchQuality;
  message: string;
}

interface CommentData {
  id: string;
  startPosition: number;
  endPosition: number;
  highlighted_text: string;
  created_at?: string; // CRITICAL FIX: Required for fresh comment detection
  [key: string]: unknown;
}

/**
 * Find text in document and return its position
 *
 * Uses multiple strategies:
 * 1. Exact match (case-sensitive)
 * 2. Case-insensitive match
 * 3. Fuzzy match (Levenshtein distance)
 *
 * For multiple matches, returns the one closest to originalPosition
 */
export function findTextInDocument(
  documentContent: string,
  highlightedText: string,
  originalPosition: number
): TextMatchResult | null {
  // Validate input
  if (!highlightedText || highlightedText.length < 3) {
    return null;
  }

  // Strategy 1: Exact match (case-sensitive)
  const exactMatches = findAllOccurrences(documentContent, highlightedText, true);
  if (exactMatches.length > 0) {
    const closest = findClosestMatch(exactMatches, originalPosition);
    return {
      found: true,
      startPosition: closest,
      endPosition: closest + highlightedText.length,
      matchQuality: 'exact'
    };
  }

  // Strategy 2: Case-insensitive match
  const caseInsensitiveMatches = findAllOccurrences(documentContent, highlightedText, false);
  if (caseInsensitiveMatches.length > 0) {
    const closest = findClosestMatch(caseInsensitiveMatches, originalPosition);
    return {
      found: true,
      startPosition: closest,
      endPosition: closest + highlightedText.length,
      matchQuality: 'case-insensitive'
    };
  }

  // Strategy 3: Fuzzy match (for minor typos or edits)
  const fuzzyMatch = findFuzzyMatch(documentContent, highlightedText, originalPosition);
  if (fuzzyMatch) {
    return {
      found: true,
      startPosition: fuzzyMatch.position,
      endPosition: fuzzyMatch.position + fuzzyMatch.length,
      matchQuality: 'fuzzy'
    };
  }

  return null;
}

/**
 * Find all occurrences of text in document
 */
function findAllOccurrences(
  documentContent: string,
  searchText: string,
  caseSensitive: boolean
): number[] {
  const positions: number[] = [];
  const doc = caseSensitive ? documentContent : documentContent.toLowerCase();
  const search = caseSensitive ? searchText : searchText.toLowerCase();

  let position = doc.indexOf(search);
  while (position !== -1) {
    positions.push(position);
    position = doc.indexOf(search, position + 1);
  }

  return positions;
}

/**
 * Find the closest match to the original position
 */
function findClosestMatch(positions: number[], originalPosition: number): number {
  if (positions.length === 1) {
    return positions[0];
  }

  return positions.reduce((closest, current) => {
    const currentDistance = Math.abs(current - originalPosition);
    const closestDistance = Math.abs(closest - originalPosition);
    return currentDistance < closestDistance ? current : closest;
  });
}

/**
 * Find fuzzy match using sliding window and Levenshtein distance
 */
function findFuzzyMatch(
  documentContent: string,
  searchText: string,
  originalPosition: number
): { position: number; length: number } | null {
  const windowSize = searchText.length;
  const maxDistance = Math.floor(searchText.length * 0.2); // Allow 20% difference

  let bestMatch: { position: number; length: number; distance: number } | null = null;

  // Search around original position first (within ±50 chars)
  const searchStart = Math.max(0, originalPosition - 50);
  const searchEnd = Math.min(documentContent.length, originalPosition + searchText.length + 50);

  for (let i = searchStart; i <= searchEnd - windowSize; i++) {
    const window = documentContent.substring(i, i + windowSize);
    const distance = levenshteinDistance(searchText.toLowerCase(), window.toLowerCase());

    if (distance <= maxDistance) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = { position: i, length: windowSize, distance };
      }
    }
  }

  return bestMatch ? { position: bestMatch.position, length: bestMatch.length } : null;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate match quality between two strings
 */
export function calculateMatchQuality(str1: string, str2: string): MatchQuality {
  // Exact match
  if (str1 === str2) {
    return 'exact';
  }

  // Case-insensitive match
  if (str1.toLowerCase() === str2.toLowerCase()) {
    return 'case-insensitive';
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  const similarity = 1 - (distance / maxLength);

  if (similarity >= 0.8) {
    return 'fuzzy';
  } else if (similarity >= 0.5) {
    return 'poor';
  }

  return 'none';
}

/**
 * Recover comment position after document changes
 *
 * Main entry point for position recovery logic
 */
export function recoverCommentPosition(
  comment: CommentData,
  currentDocumentContent: string
): PositionRecoveryResult {
  // CRITICAL FIX: Skip position recovery for fresh comments (< 10 seconds old)
  // Fresh comments are already at correct TipTap positions
  // Position recovery uses plain text coordinates which causes offset bug
  // This restores the proven fix from commit 374cbae (PR#43)
  const createdAtValue = comment.created_at;
  if (createdAtValue) {
    const createdAt = new Date(createdAtValue);
    const now = new Date();
    const ageInSeconds = (now.getTime() - createdAt.getTime()) / 1000;

    if (ageInSeconds < 10) {
      return {
        status: 'fallback',
        newStartPosition: comment.startPosition,
        newEndPosition: comment.endPosition,
        matchQuality: 'none',
        message: 'Fresh comment - using original position'
      };
    }
  }

  // Fallback for legacy comments without highlighted_text
  if (!comment.highlighted_text || comment.highlighted_text.trim() === '') {
    return {
      status: 'fallback',
      newStartPosition: comment.startPosition,
      newEndPosition: comment.endPosition,
      matchQuality: 'none',
      message: 'Using original position (legacy comment without text)'
    };
  }

  // Try to find text in current document
  const matchResult = findTextInDocument(
    currentDocumentContent,
    comment.highlighted_text,
    comment.startPosition
  );

  // Text found - relocate comment
  if (matchResult) {
    // Exact or case-insensitive match = successful relocation
    if (matchResult.matchQuality === 'exact' || matchResult.matchQuality === 'case-insensitive') {
      return {
        status: 'relocated',
        newStartPosition: matchResult.startPosition,
        newEndPosition: matchResult.endPosition,
        matchQuality: matchResult.matchQuality,
        message: 'Comment successfully relocated to new position'
      };
    }

    // Fuzzy match = uncertain relocation
    return {
      status: 'uncertain',
      newStartPosition: matchResult.startPosition,
      newEndPosition: matchResult.endPosition,
      matchQuality: matchResult.matchQuality,
      message: 'Comment relocated to approximate match - please verify'
    };
  }

  // Text not found - mark as orphaned
  // Keep original positions but mark as potentially invalid
  const safeStartPosition = Math.min(comment.startPosition, currentDocumentContent.length);
  const safeEndPosition = Math.min(comment.endPosition, currentDocumentContent.length);

  return {
    status: 'orphaned',
    newStartPosition: safeStartPosition,
    newEndPosition: safeEndPosition,
    matchQuality: 'none',
    message: 'Original text not found - comment may be outdated'
  };
}

/**
 * Batch recover positions for multiple comments
 * Optimized for performance with large comment lists
 */
export function batchRecoverCommentPositions(
  comments: CommentData[],
  currentDocumentContent: string
): Map<string, PositionRecoveryResult> {
  const results = new Map<string, PositionRecoveryResult>();

  for (const comment of comments) {
    const result = recoverCommentPosition(comment, currentDocumentContent);
    results.set(comment.id, result);
  }

  return results;
}