import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { ComponentData } from './validation';

/**
 * Extract components from a ProseMirror document
 *
 * Core business logic for the paragraph=component model.
 * Each paragraph becomes a numbered component (C1, C2, C3...)
 * except [[HEADER]] paragraphs which are visual markers for ElevenLabs.
 *
 * Reusable across all workflow phases: Script → Scenes → Voice → Edit
 *
 * @param doc - ProseMirror document node
 * @param generateHash - Hash function for component content
 * @returns Array of ComponentData with sequential numbering
 *
 * @example
 * ```typescript
 * const components = extractComponents(editor.state.doc, generateHash);
 * // Returns: [{ number: 1, content: "...", wordCount: 5, hash: "abc" }, ...]
 * ```
 */
export function extractComponents(
  doc: ProseMirrorNode,
  generateHash: (text: string) => string
): ComponentData[] {
  const components: ComponentData[] = [];
  let componentNum = 0;

  // Pattern to detect [[HEADER]] paragraphs (these are NOT components)
  const headerPattern = /^\[\[([A-Z0-9\s\-_]+)\]\]$/;

  doc.forEach((node: ProseMirrorNode) => {
    if (node.type.name === 'paragraph' && node.content.size > 0 && node.textContent.trim().length > 0) {
      const trimmedText = node.textContent.trim();

      // Skip paragraphs that are ONLY [[HEADER]] patterns
      // These are visual subheaders for ElevenLabs, not production components
      if (headerPattern.test(trimmedText)) {
        return; // Skip this paragraph - it's a header, not a component
      }

      componentNum++;
      components.push({
        number: componentNum,
        content: node.textContent,
        wordCount: node.textContent.split(/\s+/).filter(Boolean).length,
        hash: generateHash(node.textContent)
      });
    }
  });

  return components;
}

/**
 * Check if a paragraph should be numbered as a component
 * Used by visual decorations (ParagraphComponentTracker)
 *
 * @param text - Paragraph text content
 * @returns true if paragraph is a component (not a header)
 *
 * @example
 * ```typescript
 * isComponentParagraph("[[INTRO]]") // false
 * isComponentParagraph("This is content") // true
 * ```
 */
export function isComponentParagraph(text: string): boolean {
  const headerPattern = /^\[\[([A-Z0-9\s\-_]+)\]\]$/;
  return !headerPattern.test(text.trim());
}
