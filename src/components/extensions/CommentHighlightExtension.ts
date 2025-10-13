/**
 * CommentHighlightExtension - TipTap Mark for Comment Highlights with Numbering
 *
 * Implementation of Google Docs-style comment highlighting using TipTap marks.
 * Based on ADR-003 architecture requirements.
 *
 * Features:
 * - Mark-based highlighting (non-intrusive to document structure)
 * - Comment ID tracking for database integration
 * - Sequential numbering system (1, 2, 3...)
 * - Position-based anchoring support
 * - Visual highlighting with CSS classes and number badges
 * - Hover interactions for comment-highlight connection
 */

import { Mark, markInputRule, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

// Mark input rule for comment highlighting (currently not used, but could be extended)
// Note: type will be resolved at runtime when extension is registered
const commentHighlightInputRule = markInputRule({
  find: /(?:\*\*)([^*]+)(?:\*\*)/g,
  type: 'commentHighlight' as never, // Will be resolved by TipTap at runtime
});

export interface CommentHighlightOptions {
  HTMLAttributes: Record<string, unknown>;
  onHighlightClick?: (commentId: string, commentNumber: number) => void;
  onHighlightHover?: (commentId: string, commentNumber: number, isHovering: boolean) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentHighlight: {
      /**
       * Add a comment highlight mark to the selected text with numbering
       */
      addCommentHighlight: (attributes: {
        commentId: string;
        commentNumber: number;
        from: number;
        to: number;
        resolved?: boolean;
      }) => ReturnType;
      /**
       * Remove comment highlight by comment ID
       */
      removeCommentHighlight: (commentId: string) => ReturnType;
      /**
       * Toggle comment highlight
       */
      toggleCommentHighlight: (attributes: { commentId: string; commentNumber: number }) => ReturnType;
      /**
       * Load existing highlights from database
       */
      loadExistingHighlights: (highlights: Array<{
        commentId: string;
        commentNumber: number;
        startPosition: number;
        endPosition: number;
        resolved?: boolean;
      }>) => ReturnType;
    };
  }
}

// Critical-Engineer: consulted for Comment position tracking logic and test strategy
/**
 * CommentHighlightExtension with Numbering Support
 *
 * Creates a TipTap Mark that can highlight text without affecting document structure.
 * Each highlight is associated with a comment ID and sequential number for visual connection.
 * Includes hover interactions and click handlers for comment-highlight connection.
 */
export const CommentHighlightExtension = Mark.create<CommentHighlightOptions>({
  name: 'commentHighlight',

  // Explicit inclusivity: false prevents accidental expansion when typing at edges
  // This makes mark behavior predictable and prevents comments from growing unexpectedly
  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      onHighlightClick: undefined,
      onHighlightHover: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            'data-comment-id': attributes.commentId,
          };
        },
      },
      commentNumber: {
        default: null,
        parseHTML: element => {
          const num = element.getAttribute('data-comment-number');
          return num ? parseInt(num, 10) : null;
        },
        renderHTML: attributes => {
          if (!attributes.commentNumber) {
            return {};
          }
          return {
            'data-comment-number': attributes.commentNumber,
          };
        },
      },
      // Priority 3: resolved status for visual distinction
      resolved: {
        default: false,
        parseHTML: element => element.getAttribute('data-resolved') === 'true',
        renderHTML: attributes => {
          return {
            'data-resolved': attributes.resolved ? 'true' : 'false',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const commentId = mark.attrs.commentId;
    const commentNumber = mark.attrs.commentNumber;
    const resolved = mark.attrs.resolved;

    // Priority 3: Add resolved class for visual distinction
    const cssClass = resolved ? 'comment-highlight comment-resolved' : 'comment-highlight';

    const attrs = {
      ...mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      'class': cssClass,
      'data-comment-id': commentId,
      'data-comment-number': commentNumber,
      'data-resolved': resolved ? 'true' : 'false',
      'title': `Comment ${commentNumber}${resolved ? ' (Resolved)' : ''}`,
    };

    return ['mark', attrs, 0];
  },

  addCommands() {
    return {
      addCommentHighlight:
        (attributes) =>
        ({ commands: _commands, state, dispatch }) => {
          const { from, to, commentId, commentNumber, resolved } = attributes;

          if (from === to) {
            return false;
          }

          // Apply the comment highlight mark to the specified range
          const tr = state.tr.addMark(
            from,
            to,
            state.schema.marks.commentHighlight.create({
              commentId,
              commentNumber,
              resolved: resolved || false,
            })
          );

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },

      removeCommentHighlight:
        (commentId) =>
        ({ state, dispatch }) => {
          const { tr } = state;
          const { doc } = tr;

          // Find all comment highlights with the specified commentId
          doc.descendants((node, pos) => {
            if (node.isText && node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type.name === 'commentHighlight' && mark.attrs.commentId === commentId) {
                  const from = pos;
                  const to = pos + node.nodeSize;
                  tr.removeMark(from, to, mark.type);
                }
              });
            }
          });

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },

      toggleCommentHighlight:
        (attributes) =>
        ({ commands: _commands }) => {
          return _commands.toggleMark(this.name, attributes);
        },

      loadExistingHighlights:
        (highlights) =>
        ({ state, dispatch, view: _view }) => {
          const { tr } = state;

          highlights.forEach(({ commentId, commentNumber, startPosition, endPosition, resolved }) => {
            // Ensure positions are within document bounds
            const docSize = tr.doc.content.size;
            const from = Math.max(0, Math.min(startPosition, docSize));
            const to = Math.max(from, Math.min(endPosition, docSize));

            if (from < to) {
              tr.addMark(
                from,
                to,
                state.schema.marks.commentHighlight.create({
                  commentId,
                  commentNumber,
                  resolved: resolved || false,
                })
              );
            }
          });

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      // Plugin to handle click and hover events on highlights
      new Plugin({
        props: {
          handleClick: (view, pos, event) => {
            const target = event.target as HTMLElement;

            if (target.classList.contains('comment-highlight')) {
              const commentId = target.getAttribute('data-comment-id');
              const commentNumber = target.getAttribute('data-comment-number');

              if (commentId && commentNumber && options.onHighlightClick) {
                options.onHighlightClick(commentId, parseInt(commentNumber, 10));
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },

  addInputRules() {
    return [commentHighlightInputRule];
  },
});