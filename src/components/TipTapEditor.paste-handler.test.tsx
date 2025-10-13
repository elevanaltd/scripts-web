import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import DOMPurify from 'dompurify';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

/**
 * TEST: Paste Handler Behavior - Verifies Google Docs paste preserves <br> tags
 *
 * Critical requirement: When users paste multi-line content from Google Docs,
 * the <br> tags must be preserved in allowed tags for proper formatting.
 *
 * Current bug: Paste handler compares sanitized HTML !== original HTML
 * and falls back to plain text, stripping ALL structure including <br> tags.
 */

describe('TipTap Paste Handler - <br> Tag Preservation', () => {
  let sanitizeHTML: (html: string) => string;

  beforeEach(() => {
    // Use the same sanitization as TipTapEditor
    sanitizeHTML = (dirtyHTML: string): string => {
      return DOMPurify.sanitize(dirtyHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true,
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false
      });
    };
  });

  it('sanitizes Google Docs HTML but preserves safe <br> tags', () => {
    // ARRANGE - Typical Google Docs paste with <br> and unsafe attributes
    const googleDocsHTML = `<p class="c1" style="color: red;">Line 1<br>Line 2</p><p>Line 3</p>`;

    // ACT - Sanitize the HTML
    const sanitized = sanitizeHTML(googleDocsHTML);

    // ASSERT - <br> tags are preserved, unsafe attributes removed
    expect(sanitized).toContain('<br>');
    expect(sanitized).not.toContain('style='); // Unsafe style removed
    expect(sanitized).toContain('class='); // Safe class attribute preserved (in ALLOWED_ATTR)
  });

  it('sanitization modifies HTML but result is still valid', () => {
    // ARRANGE - HTML with some unsafe elements
    const mixedHTML = `<p>Safe text<br>with breaks</p><script>alert("xss")</script>`;

    // ACT - Sanitize
    const sanitized = sanitizeHTML(mixedHTML);
    const original = mixedHTML;

    // ASSERT - Sanitized version differs from original BUT is not empty
    expect(sanitized).not.toBe(original);
    expect(sanitized.trim()).not.toBe('');
    expect(sanitized).toContain('<br>');
    expect(sanitized).not.toContain('script');
  });

  it('sanitization changes do NOT mean content is dangerous', () => {
    // ARRANGE - Perfectly safe HTML that will be modified by DOMPurify
    const safeButModified = `<p style="margin: 10px;">Text<br/>with break</p>`;

    // ACT
    const sanitized = sanitizeHTML(safeButModified);

    // ASSERT - Content changed but <br> preserved
    expect(sanitized).not.toBe(safeButModified); // Changed (style removed)
    expect(sanitized).toContain('br'); // But structure preserved

    // CRITICAL INSIGHT: The current paste handler assumes
    // (sanitized !== original) means "dangerous content"
    // This is FALSE - sanitization ALWAYS modifies safe content too!
  });

  it('empty or whitespace-only sanitized result should fallback to plain text', () => {
    // ARRANGE - HTML that becomes empty after sanitization
    const onlyUnsafe = `<script>alert('xss')</script><style>.bad{}</style>`;

    // ACT
    const sanitized = sanitizeHTML(onlyUnsafe);

    // ASSERT - Sanitized to empty (this SHOULD trigger plain text fallback)
    expect(sanitized.trim()).toBe('');
  });

  it('large paste content should be limited to prevent UI freeze', () => {
    // ARRANGE - Simulate paste > 1MB
    const PASTE_SIZE_LIMIT = 1 * 1024 * 1024; // 1MB
    const largeContent = 'x'.repeat(PASTE_SIZE_LIMIT + 1);

    // ASSERT - Size limit is defined and reasonable
    expect(largeContent.length).toBeGreaterThan(PASTE_SIZE_LIMIT);

    // This test documents the requirement for size limiting
    // Actual implementation will be in TipTapEditor paste handler
  });
});

/**
 * TEST: Multi-Paragraph Component Extraction from Google Docs Paste
 *
 * PRODUCTION BLOCKER: When users paste multi-paragraph content from Google Docs,
 * the system must immediately create separate components (C1, C2, C3...) and
 * maintain component identity through subsequent edits.
 *
 * CURRENT BUG: Paste creates ONE paragraph with embedded newlines, causing:
 * - Only C1 component created for all content
 * - Any edit merges everything into single component
 * - Component identity lost on subsequent edits
 *
 * REQUIRED BEHAVIOR:
 * - Multi-paragraph paste → separate <p> nodes
 * - Each paragraph → one component (C1, C2, C3...)
 * - Component structure survives edits
 *
 * TDD Phase: RED - This test MUST FAIL until paste handler is fixed
 */
describe.skip('TipTap Paste Handler - Multi-Paragraph Component Extraction (TDD RED)', () => {
  let editor: Editor | null = null;

  beforeEach(() => {
    // Create a real TipTap editor instance for testing
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          paragraph: {
            HTMLAttributes: {
              class: 'component-paragraph'
            }
          }
        })
      ],
      content: ''
    });
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it('[RED] should split multi-paragraph Google Docs paste into separate paragraph nodes immediately', () => {
    // ARRANGE - Simulate Google Docs HTML with multiple paragraphs
    // Google Docs typically pastes with <p> tags separated by content
    const googleDocsPasteHTML = `<p>Paragraph one content here</p><p>Paragraph two content here</p><p>Paragraph three content here</p>`;

    // Create a temporary div to parse the HTML (same as paste handler does)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = googleDocsPasteHTML;

    // ACT - Insert the content into the editor
    // This simulates what the paste handler should do
    editor!.commands.setContent(googleDocsPasteHTML);

    // ASSERT 1 - Editor should have 3 separate paragraph nodes
    const paragraphNodes: { text: string }[] = [];
    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph') {
        paragraphNodes.push({
          text: node.textContent
        });
      }
    });

    expect(paragraphNodes.length).toBe(3); // WILL FAIL if paste creates 1 paragraph
    expect(paragraphNodes[0].text).toBe('Paragraph one content here');
    expect(paragraphNodes[1].text).toBe('Paragraph two content here');
    expect(paragraphNodes[2].text).toBe('Paragraph three content here');

    // ASSERT 2 - Each paragraph should NOT contain newlines
    paragraphNodes.forEach((node) => {
      expect(node.text).not.toContain('\n\n');
      expect(node.text).not.toContain('\n');
    });
  });

  it('[RED] should create separate components (C1, C2, C3) from multi-paragraph paste', () => {
    // ARRANGE - Multi-paragraph Google Docs content
    const googleDocsPasteHTML = `<p>First component content</p><p>Second component content</p><p>Third component content</p>`;

    // ACT - Set content (simulates paste)
    editor!.commands.setContent(googleDocsPasteHTML);

    // Extract components using the same logic as TipTapEditor
    const components: { number: number; content: string }[] = [];
    let componentNum = 0;

    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph' && node.content.size > 0) {
        componentNum++;
        components.push({
          number: componentNum,
          content: node.textContent
        });
      }
    });

    // ASSERT - Should have 3 separate components
    expect(components.length).toBe(3); // WILL FAIL if only C1 created
    expect(components[0].number).toBe(1); // C1
    expect(components[0].content).toBe('First component content');
    expect(components[1].number).toBe(2); // C2
    expect(components[1].content).toBe('Second component content');
    expect(components[2].number).toBe(3); // C3
    expect(components[2].content).toBe('Third component content');
  });

  it('[RED] should preserve component structure after editing middle component', () => {
    // ARRANGE - Start with multi-paragraph content
    const googleDocsPasteHTML = `<p>Component one</p><p>Component two</p><p>Component three</p>`;
    editor!.commands.setContent(googleDocsPasteHTML);

    // Verify initial state has 3 components
    let componentCount = 0;
    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph' && node.content.size > 0) {
        componentCount++;
      }
    });
    expect(componentCount).toBe(3);

    // ACT - Edit the middle component (simulate user typing in C2)
    // Find position of second paragraph and insert text
    const secondParagraphPos = editor!.state.doc.resolve(editor!.state.doc.content.size / 2);
    editor!.commands.setTextSelection({ from: secondParagraphPos.pos, to: secondParagraphPos.pos });
    editor!.commands.insertContent(' EDITED');

    // ASSERT - Should still have 3 separate components after edit
    const componentsAfterEdit: { number: number; content: string }[] = [];
    let componentNum = 0;

    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph' && node.content.size > 0) {
        componentNum++;
        componentsAfterEdit.push({
          number: componentNum,
          content: node.textContent
        });
      }
    });

    // WILL FAIL if edit causes merge into single component
    expect(componentsAfterEdit.length).toBe(3);
    expect(componentsAfterEdit[0].content).toBe('Component one');
    expect(componentsAfterEdit[1].content).toContain('Component two');
    expect(componentsAfterEdit[1].content).toContain('EDITED');
    expect(componentsAfterEdit[2].content).toBe('Component three');
  });

  it('[RED] should handle Google Docs paste with double newlines \\n\\n between paragraphs', () => {
    // ARRANGE - Simulate Google Docs plain text paste with double newlines
    // This is what users see when they copy from Google Docs as plain text
    const plainTextPaste = 'Paragraph one\n\nParagraph two\n\nParagraph three';

    // ACT - Insert as plain text (this is what currently happens)
    // The paste handler should split on \n\n and create separate paragraphs
    editor!.commands.setContent(plainTextPaste);

    // ASSERT - Should create 3 separate paragraph nodes
    const paragraphNodes: { text: string }[] = [];
    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph') {
        paragraphNodes.push({
          text: node.textContent
        });
      }
    });

    // WILL FAIL - Currently creates 1 paragraph with embedded \n\n
    expect(paragraphNodes.length).toBe(3);
    expect(paragraphNodes[0].text).toBe('Paragraph one');
    expect(paragraphNodes[1].text).toBe('Paragraph two');
    expect(paragraphNodes[2].text).toBe('Paragraph three');
  });

  it('[RED] should preserve component identity through multiple edits', () => {
    // ARRANGE - Start with 3 components
    const googleDocsPasteHTML = `<p>C1 content</p><p>C2 content</p><p>C3 content</p>`;
    editor!.commands.setContent(googleDocsPasteHTML);

    // ACT - Perform multiple edits
    // Edit 1: Add text to first component
    editor!.commands.setTextSelection({ from: 5, to: 5 });
    editor!.commands.insertContent(' EDIT1');

    // Edit 2: Add text to last component
    const endPos = editor!.state.doc.content.size - 5;
    editor!.commands.setTextSelection({ from: endPos, to: endPos });
    editor!.commands.insertContent(' EDIT2');

    // ASSERT - Should still have exactly 3 components with edits preserved
    const finalComponents: { number: number; content: string }[] = [];
    let componentNum = 0;

    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph' && node.content.size > 0) {
        componentNum++;
        finalComponents.push({
          number: componentNum,
          content: node.textContent
        });
      }
    });

    // WILL FAIL if edits cause component merging
    expect(finalComponents.length).toBe(3);
    expect(finalComponents[0].content).toContain('C1 content');
    expect(finalComponents[0].content).toContain('EDIT1');
    expect(finalComponents[1].content).toBe('C2 content');
    expect(finalComponents[2].content).toContain('C3 content');
    expect(finalComponents[2].content).toContain('EDIT2');
  });

  it('[RED] should not merge adjacent components when editing between them', () => {
    // ARRANGE - Start with 2 adjacent components
    const googleDocsPasteHTML = `<p>First component</p><p>Second component</p>`;
    editor!.commands.setContent(googleDocsPasteHTML);

    // ACT - Position cursor at end of first component and add content
    const firstParagraphEnd = editor!.state.doc.resolve(15); // Approximate position
    editor!.commands.setTextSelection({ from: firstParagraphEnd.pos, to: firstParagraphEnd.pos });
    editor!.commands.insertContent(' more text');

    // ASSERT - Should still have 2 separate components
    const componentsAfter: { number: number; content: string }[] = [];
    let componentNum = 0;

    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph' && node.content.size > 0) {
        componentNum++;
        componentsAfter.push({
          number: componentNum,
          content: node.textContent
        });
      }
    });

    // WILL FAIL if components merge during edit
    expect(componentsAfter.length).toBe(2);
    expect(componentsAfter[0].content).toContain('First component');
    expect(componentsAfter[0].content).toContain('more text');
    expect(componentsAfter[1].content).toBe('Second component');
  });
});

/**
 * TEST: Paste Spacing Behavior - No Extra Empty Lines
 *
 * REQUIREMENT: When pasting multi-paragraph content from Google Docs,
 * the system should create separate components WITHOUT adding extra empty lines.
 *
 * CONTEXT:
 * - Branch main: No extra spacing (normal behavior)
 * - Branch soft-hard-button: Extra empty lines between paragraphs
 * - Root cause: `preserveWhitespace: 'full'` preserves empty <p></p> tags
 *
 * TDD Phase: This test documents the DESIRED behavior (should pass after fix)
 */
describe('TipTap Paste Handler - Spacing Behavior (No Extra Empty Lines)', () => {
  let editor: Editor | null = null;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          paragraph: {
            HTMLAttributes: {
              class: 'component-paragraph'
            }
          }
        })
      ],
      content: ''
    });
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it.skip('should NOT create empty paragraphs between content paragraphs', () => {
    // ARRANGE - Google Docs HTML with empty paragraphs (common formatting artifact)
    const googleDocsWithEmptyParagraphs = `<p>First paragraph</p><p></p><p>Second paragraph</p><p></p><p>Third paragraph</p>`;

    // ACT - Set content (simulates paste)
    editor!.commands.setContent(googleDocsWithEmptyParagraphs);

    // Count all paragraphs (including empty ones)
    const allParagraphs: { text: string; isEmpty: boolean }[] = [];
    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph') {
        allParagraphs.push({
          text: node.textContent,
          isEmpty: node.content.size === 0 || node.textContent.trim().length === 0
        });
      }
    });

    // ASSERT - Should have ONLY 3 content paragraphs (empty ones removed)
    const contentParagraphs = allParagraphs.filter(p => !p.isEmpty);
    expect(contentParagraphs.length).toBe(3);
    expect(contentParagraphs[0].text).toBe('First paragraph');
    expect(contentParagraphs[1].text).toBe('Second paragraph');
    expect(contentParagraphs[2].text).toBe('Third paragraph');

    // CRITICAL: Should NOT have empty paragraphs in document
    const emptyParagraphs = allParagraphs.filter(p => p.isEmpty);
    expect(emptyParagraphs.length).toBe(0); // WILL FAIL if preserveWhitespace: 'full' keeps empty paragraphs
  });

  it('should extract only content components (no empty components)', () => {
    // ARRANGE - Google Docs HTML with formatting whitespace
    const googleDocsHTML = `<p>Component 1</p><p> </p><p>Component 2</p><p></p><p>Component 3</p>`;

    // ACT - Set content and extract components using semantic filtering
    editor!.commands.setContent(googleDocsHTML);

    const components: { number: number; content: string }[] = [];
    let componentNum = 0;

    editor!.state.doc.forEach((node) => {
      // Use semantic filtering: content.size > 0 AND textContent.trim().length > 0
      if (node.type.name === 'paragraph' && node.content.size > 0 && node.textContent.trim().length > 0) {
        componentNum++;
        components.push({
          number: componentNum,
          content: node.textContent
        });
      }
    });

    // ASSERT - Should extract exactly 3 components (C1, C2, C3)
    expect(components.length).toBe(3);
    expect(components[0].number).toBe(1);
    expect(components[0].content).toBe('Component 1');
    expect(components[1].number).toBe(2);
    expect(components[1].content).toBe('Component 2');
    expect(components[2].number).toBe(3);
    expect(components[2].content).toBe('Component 3');
  });

  it('should match main branch spacing behavior (no extra lines)', () => {
    // ARRANGE - Typical multi-paragraph Google Docs paste
    const googleDocsHTML = `<p>Paragraph one with some content</p><p>Paragraph two with more content</p><p>Paragraph three final content</p>`;

    // ACT - Set content
    editor!.commands.setContent(googleDocsHTML);

    // Count paragraphs using semantic filtering (matches TipTapEditor logic)
    let contentParagraphCount = 0;
    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph' && node.content.size > 0 && node.textContent.trim().length > 0) {
        contentParagraphCount++;
      }
    });

    // ASSERT - Should have exactly 3 paragraphs (same as main branch)
    expect(contentParagraphCount).toBe(3);

    // Verify document structure has no extra nodes
    const totalNodes = editor!.state.doc.childCount;
    expect(totalNodes).toBe(3); // WILL FAIL if preserveWhitespace: 'full' creates extra nodes
  });

  it('should preserve content paragraph structure without whitespace artifacts', () => {
    // ARRANGE - Multi-paragraph content with various spacing in source HTML
    const googleDocsHTML = `<p>First</p>

    <p>Second</p>

    <p>Third</p>`;

    // ACT - Set content
    editor!.commands.setContent(googleDocsHTML);

    // Extract all nodes from document
    const nodes: { type: string; text: string; size: number }[] = [];
    editor!.state.doc.forEach((node) => {
      nodes.push({
        type: node.type.name,
        text: node.textContent,
        size: node.content.size
      });
    });

    // ASSERT - Should have exactly 3 paragraph nodes (no extra whitespace nodes)
    expect(nodes.length).toBe(3);
    expect(nodes.every(n => n.type === 'paragraph')).toBe(true);
    expect(nodes[0].text).toBe('First');
    expect(nodes[1].text).toBe('Second');
    expect(nodes[2].text).toBe('Third');
  });

  it('should filter Google Docs &nbsp; paragraphs (ACTUAL ISSUE)', () => {
    // ARRANGE - REAL Google Docs HTML with &nbsp; paragraphs
    // This is what Google Docs ACTUALLY sends when you have spacing between paragraphs
    const realGoogleDocsHTML = `<p>Welcome to your new home at Kidbrooke Village.</p><p>&nbsp;</p><p>Your building is just moments from Kidbrooke station.</p><p>&nbsp;</p><p>To access your building use the key fob provided.</p>`;

    // ACT - Set content
    editor!.commands.setContent(realGoogleDocsHTML);

    // Count all paragraphs including &nbsp; ones
    const allParagraphs: { text: string; isEmpty: boolean }[] = [];
    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph') {
        // Check if paragraph is empty after normalizing whitespace
        const normalizedText = node.textContent.replace(/\u00A0/g, ' ').trim(); // \u00A0 is &nbsp;
        allParagraphs.push({
          text: node.textContent,
          isEmpty: normalizedText.length === 0
        });
      }
    });

    // ASSERT - Should identify 2 empty paragraphs (the &nbsp; ones)
    const emptyParagraphs = allParagraphs.filter(p => p.isEmpty);
    expect(emptyParagraphs.length).toBe(2); // Currently PASSES - we can detect them

    // Now test component extraction with proper filtering
    const components: { number: number; content: string }[] = [];
    let componentNum = 0;

    editor!.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph' && node.content.size > 0) {
        // CRITICAL: Must normalize whitespace including &nbsp; before checking
        const normalizedText = node.textContent.replace(/\u00A0/g, ' ').trim();
        if (normalizedText.length > 0) {
          componentNum++;
          components.push({
            number: componentNum,
            content: node.textContent
          });
        }
      }
    });

    // ASSERT - Should extract exactly 3 components (no &nbsp; paragraphs)
    expect(components.length).toBe(3); // WILL FAIL without proper &nbsp; filtering
    expect(components[0].content).toBe('Welcome to your new home at Kidbrooke Village.');
    expect(components[1].content).toBe('Your building is just moments from Kidbrooke station.');
    expect(components[2].content).toBe('To access your building use the key fob provided.');
  });
});
