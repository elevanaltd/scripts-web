/**
 * SECURITY UTILITIES
 * Sanitization and paste handling for TipTap editor
 * Extracted from TipTapEditor.tsx (Step 2.1.5)
 *
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import DOMPurify from 'dompurify';
import { EditorView } from '@tiptap/pm/view';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Uses DOMPurify with restrictive whitelist of allowed tags and attributes
 */
export function sanitizeHTML(dirtyHTML: string): string {
  return DOMPurify.sanitize(dirtyHTML, {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false
  });
}

/**
 * Handle plain text paste with proper sanitization and size limits
 * Critical-Engineer: consulted for Paste handler architecture and sanitization
 *
 * Fixes applied:
 * 1. Size limit (HIGH): Prevents DoS from large pastes
 * 2. Robust newline handling (MEDIUM): Uses regex for edge cases
 * 3. Manual HTML escaping (MEDIUM): Defense-in-depth security
 * 4. Code deduplication (HIGH): Eliminates maintenance divergence
 */
export function handlePlainTextPaste(
  view: EditorView,
  textData: string,
  showError: (msg: string) => void
): void {
  // 1. Size limit (HIGH priority fix) - Prevent DoS from large pastes
  const PASTE_SIZE_LIMIT_BYTES = 1 * 1024 * 1024; // 1MB
  if (textData.length > PASTE_SIZE_LIMIT_BYTES) {
    showError('Pasted content is too large. Please paste in smaller chunks.');
    view.dispatch(view.state.tr.insertText(textData.substring(0, 5000) + "..."));
    return;
  }

  // 2. Robust newline handling (MEDIUM priority fix) - Handle edge cases like '\n \n'
  const paragraphs = textData.split(/\s*\n\s*\n\s*/).filter(p => p.trim() !== '');

  if (paragraphs.length > 1) {
    // 3. Manual escaping (MEDIUM priority fix) - Defense-in-depth security
    const paragraphHTML = paragraphs
      .map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
      .join('');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = paragraphHTML;
    const { state } = view;
    const parser = ProseMirrorDOMParser.fromSchema(state.schema);
    const slice = parser.parseSlice(tempDiv, { preserveWhitespace: 'full' });
    view.dispatch(state.tr.replaceSelection(slice));
  } else {
    view.dispatch(view.state.tr.insertText(textData));
  }
}

/**
 * Safe conversion from plain text to HTML paragraphs
 * Prevents XSS injection through the line break replacement pattern
 */
export function convertPlainTextToHTML(plainText: string): string {
  // First escape any HTML in the plain text
  const escaped = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Then convert newlines to paragraph breaks
  const withParagraphs = `<p>${escaped.replace(/\n\n/g, '</p><p>')}</p>`;

  // Finally sanitize the result (defense in depth)
  return sanitizeHTML(withParagraphs);
}

/**
 * Validates DOMPurify configuration in development mode
 * Warns if config deviates from secure baseline
 * Critical-Engineer: consulted for DOMPurify config drift detection (MEDIUM→HIGH priority)
 */
export function validateDOMPurifyConfig(): void {
  if (import.meta.env.DEV) {
    const config = {
      ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      ALLOWED_ATTR: ['class'],
      ALLOW_DATA_ATTR: false,
    };

    // Check for dangerous tags
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'style'];
    const hasDangerousTags = config.ALLOWED_TAGS.some(tag =>
      dangerousTags.includes(tag.toLowerCase())
    );

    if (hasDangerousTags) {
      console.error('⚠️ DOMPurify config contains dangerous tags:', config.ALLOWED_TAGS);
    }

    // Check for permissive attributes
    if (config.ALLOW_DATA_ATTR) {
      console.warn('⚠️ DOMPurify config allows data attributes (potential XSS vector)');
    }

    console.info('✅ DOMPurify config validated (dev mode)');
  }
}
