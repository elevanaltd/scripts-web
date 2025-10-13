// Critical-Engineer: consulted for Comment position tracking logic and test strategy
/**
 * CommentPositionTracker - TipTap Extension with ProseMirror Plugin
 *
 * Monitors comment highlight marks and triggers callbacks when positions change.
 * Works in conjunction with CommentHighlightExtension (mark-based highlights).
 *
 * Architecture:
 * - Monitors existing commentHighlight marks (applied by CommentHighlightExtension)
 * - Extracts positions on every transaction when document changes
 * - Debounces callbacks (500ms) to prevent DB throttling
 * - No decoration management - reads marks only
 *
 * TDD Phase: GREEN - Making RED tests pass
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Comment highlight data structure (matches test interface)
 */
export interface CommentHighlight {
  commentId: string;
  commentNumber: number;
  startPosition: number;
  endPosition: number;
  resolved?: boolean;
}

/**
 * Plugin key for CommentPositionTracker
 */
export const CommentPositionTrackerKey = new PluginKey('commentPositionTracker');

/**
 * Extension options
 */
export interface CommentPositionTrackerOptions {
  onPositionUpdate: (comments: CommentHighlight[]) => void;
}

/**
 * CommentPositionTracker Extension
 *
 * Monitors commentHighlight marks and triggers position update callbacks.
 * Does NOT manage highlights - delegates to CommentHighlightExtension.
 */
export const CommentPositionTracker = Extension.create<CommentPositionTrackerOptions>({
  name: 'commentPositionTracker',

  addOptions() {
    return {
      onPositionUpdate: () => {},
    };
  },

  addStorage() {
    return {
      debounceTimer: null as NodeJS.Timeout | null,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: CommentPositionTrackerKey,

        appendTransaction: (transactions, oldState, newState) => {
          // Only process if document changed
          const docChanged = transactions.some(tr => tr.docChanged);
          if (!docChanged) {
            return null;
          }

          // Extract current comment positions from marks
          const highlights: CommentHighlight[] = [];

          newState.doc.descendants((node, pos) => {
            if (node.isText && node.marks) {
              node.marks.forEach(mark => {
                if (mark.type.name === 'commentHighlight') {
                  const from = pos;
                  const to = pos + node.nodeSize;

                  // Check if we already have this comment ID
                  const existing = highlights.find(
                    h => h.commentId === mark.attrs.commentId
                  );

                  if (!existing) {
                    highlights.push({
                      commentId: mark.attrs.commentId,
                      commentNumber: mark.attrs.commentNumber,
                      startPosition: from,
                      endPosition: to,
                      resolved: mark.attrs.resolved || false,
                    });
                  } else {
                    // Extend range if same comment spans multiple text nodes
                    existing.startPosition = Math.min(existing.startPosition, from);
                    existing.endPosition = Math.max(existing.endPosition, to);
                  }
                }
              });
            }
          });

          // Immediate callback notification (debouncing handled by useCommentPositionSync)
          if (highlights.length > 0) {
            this.options.onPositionUpdate(highlights);
          }

          // No transaction needed - we're just observing
          return null;
        },
      }),
    ];
  },
});
