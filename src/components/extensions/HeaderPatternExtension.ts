/**
 * HeaderPatternExtension - TipTap Extension for [[HEADER]] Syntax
 *
 * Purpose: Enables ElevenLabs-friendly subheaders using [[HEADER]] syntax
 * Visual: Renders [[TEXT]] as bold, gray, slightly larger
 * Persistence: Plain text survives editor.getText() extraction
 * ElevenLabs: Strip [[...]] pattern before TTS (Phase 6)
 *
 * Constitutional Compliance:
 * - Line 32 (MIP): Essential complexity - single-purpose extension
 * - Line 26 (Security): Plain text, zero XSS risk
 * - Line 18 (North Star): Preserves paragraph=component model
 *
 * User Workflow:
 * 1. Type: [[HEATING]]
 * 2. Visual: Renders bold/gray/larger
 * 3. Save: Plain text "[[HEATING]]" persists
 * 4. ElevenLabs (Phase 6): Strip [[...]] before TTS
 *
 * @example
 * User types:
 * ```
 * [[HEATING]]
 * The heating and hot water system features...
 * ```
 *
 * Renders visually as:
 * **[[HEATING]]** (bold, gray, 1.1em)
 * The heating and hot water system features...
 *
 * Saves as plain text (survives getText()):
 * "[[HEATING]]\nThe heating and hot water system features..."
 *
 * Future Phase 6 export to ElevenLabs:
 * ```typescript
 * const scriptForTTS = plainText.replace(/\[\[.*?\]\]/g, '');
 * // Result: "The heating and hot water system features..."
 * ```
 */

import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { markInputRule } from '@tiptap/core';

/**
 * Pattern to match [[HEADER]] syntax
 * Allows uppercase letters, spaces, numbers, hyphens, underscores
 */
const HEADER_PATTERN = /\[\[([A-Z0-9\s\-_]+)\]\]/g;

export interface HeaderPatternOptions {
  /**
   * HTML tag to use for rendering
   * Default: 'span'
   */
  HTMLAttributes: Record<string, string>;
}

/**
 * HeaderPattern Mark Extension
 *
 * This creates an inline mark (like bold or italic) that visually
 * differentiates [[HEADER]] text while preserving it as plain text.
 *
 * Technical Details:
 * - Type: Mark (inline formatting, not a Node)
 * - Persistence: Text content preserved in editor.getText()
 * - Rendering: Custom CSS via class="header-pattern"
 * - Parsing: Regex-based detection during paste/load
 */
export const HeaderPatternExtension = Mark.create<HeaderPatternOptions>({
  name: 'headerPattern',

  // Priority higher than other marks to ensure it wraps correctly
  priority: 1000,

  // Don't allow this mark to span across nodes
  spanning: false,

  // Don't allow nesting of header patterns
  excludes: '_',

  // CRITICAL: Prevent mark from sticking to subsequent typing
  // This tells TipTap to NOT include this mark in the "stored marks"
  // when the user types at the end of a marked range
  inclusive: false,

  // Parse HTML when loading content
  parseHTML() {
    return [
      {
        tag: 'span.header-pattern',
        // Preserve the text content including brackets
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const element = node as HTMLElement;
          const text = element.textContent || '';
          // Validate it matches our pattern
          return HEADER_PATTERN.test(text) ? {} : false;
        },
      },
    ];
  },

  // Render as span with custom class for CSS styling
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'header-pattern',
      }),
      0, // 0 means "render the content here"
    ];
  },

  // Add commands (currently none needed, but structure for future)
  addCommands() {
    return {};
  },

  // Add input rules to catch [[HEADER]] as user types the closing ]]
  addInputRules() {
    return [
      markInputRule({
        find: /\[\[([A-Z0-9\s\-_]+)\]\]$/,
        type: this.type,
      }),
    ];
  },

  // Add ProseMirror Plugin to auto-detect and wrap [[HEADER]] patterns
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          const tr = newState.tr;
          let modified = false;

          // Scan document for unwrapped [[HEADER]] patterns
          newState.doc.descendants((node, pos) => {
            if (node.isText && node.text) {
              const pattern = /\[\[([A-Z0-9\s\-_]+)\]\]/g;
              let match;

              while ((match = pattern.exec(node.text)) !== null) {
                const start = pos + match.index;
                const end = start + match[0].length;

                // Check if this range is already marked with headerPattern
                const hasHeaderMark = newState.doc.rangeHasMark(
                  start,
                  end,
                  newState.schema.marks.headerPattern
                );

                // Only add mark if not already present
                if (!hasHeaderMark) {
                  tr.addMark(
                    start,
                    end,
                    newState.schema.marks.headerPattern.create()
                  );
                  modified = true;
                }
              }
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

/**
 * Helper function for future Phase 6: ElevenLabs Export
 *
 * Strips [[HEADER]] markers from plain text before sending to TTS
 *
 * @param plainText - Raw script text from editor.getText()
 * @returns Clean text for ElevenLabs (headers removed)
 *
 * @example
 * ```typescript
 * const script = "[[HEATING]]\nThe heating system features..."
 * const forTTS = stripHeaderMarkers(script);
 * // Result: "The heating system features..."
 * ```
 */
export function stripHeaderMarkers(plainText: string): string {
  return plainText.replace(/\[\[.*?\]\]\n?/g, '');
}

/**
 * Helper function to validate header syntax
 *
 * @param text - Text to validate
 * @returns True if text matches [[HEADER]] pattern
 */
export function isValidHeaderPattern(text: string): boolean {
  const pattern = /\[\[([A-Z0-9\s\-_]+)\]\]/;
  return pattern.test(text);
}

/**
 * CSS Styles for Header Pattern (add to TipTapEditor.tsx or global CSS)
 *
 * ```css
 * .header-pattern {
 *   font-weight: 700;
 *   color: #6b7280; // gray-500
 *   font-size: 1.1em;
 *   letter-spacing: 0.02em;
 * }
 * ```
 */
