import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractComponents, isComponentParagraph } from './componentExtraction';
import { generateContentHash } from '../services/scriptService';
import { schema } from '@tiptap/pm/schema-basic';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

describe('extractComponents', () => {

  it('extracts numbered components from paragraphs', () => {
    // Create mock ProseMirror document with 3 paragraphs
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('First component')]),
      schema.node('paragraph', null, [schema.text('Second component')]),
      schema.node('paragraph', null, [schema.text('Third component')]),
    ]);

    const components = extractComponents(doc, generateContentHash);

    expect(components).toHaveLength(3);
    expect(components[0]).toEqual({
      number: 1,
      content: 'First component',
      wordCount: 2,
      hash: generateContentHash('First component')
    });
    expect(components[2].number).toBe(3);
  });

  it('skips [[HEADER]] paragraphs', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Component 1')]),
      schema.node('paragraph', null, [schema.text('[[INTRO]]')]),
      schema.node('paragraph', null, [schema.text('Component 2')]),
    ]);

    const components = extractComponents(doc, generateContentHash);

    expect(components).toHaveLength(2);
    expect(components[0].number).toBe(1);
    expect(components[1].number).toBe(2); // Not 3!
  });

  it('skips empty paragraphs', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Component 1')]),
      schema.node('paragraph', null, []), // Empty
      schema.node('paragraph', null, [schema.text('  ')]), // Whitespace only
      schema.node('paragraph', null, [schema.text('Component 2')]),
    ]);

    const components = extractComponents(doc, generateContentHash);

    expect(components).toHaveLength(2);
  });

  it('calculates word count correctly', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('One two three four five')]),
    ]);

    const components = extractComponents(doc, generateContentHash);

    expect(components[0].wordCount).toBe(5);
  });

  it('handles headers with numbers', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('[[SECTION 1]]')]),
      schema.node('paragraph', null, [schema.text('Component 1')]),
    ]);

    const components = extractComponents(doc, generateContentHash);

    expect(components).toHaveLength(1);
    expect(components[0].number).toBe(1);
  });
});

describe('List item handling', () => {
  let editor: Editor | null = null;

  beforeEach(() => {
    editor = new Editor({
      extensions: [StarterKit],
      content: '<p>Initial</p>',
    });
  });

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it('should prefix bullet list items with dashes', () => {
    editor!.commands.setContent('<ul><li><p>Rapid heating</p></li><li><p>3D Hot Air</p></li></ul>');
    const doc = editor!.state.doc;

    const components = extractComponents(doc, generateContentHash);

    expect(components).toHaveLength(2);
    expect(components[0].content).toBe('- Rapid heating');
    expect(components[0].wordCount).toBe(2); // Excludes dash
    expect(components[1].content).toBe('- 3D Hot Air');
    expect(components[1].wordCount).toBe(3);
  });

  it('should handle ordered lists with number prefixes', () => {
    editor!.commands.setContent('<ol><li><p>First step</p></li><li><p>Second step</p></li></ol>');
    const doc = editor!.state.doc;

    const components = extractComponents(doc, generateContentHash);

    expect(components).toHaveLength(2);
    expect(components[0].content).toBe('1. First step');
    expect(components[0].wordCount).toBe(2);
    expect(components[1].content).toBe('2. Second step');
    expect(components[1].wordCount).toBe(2);
  });

  it('should handle mixed paragraphs and lists', () => {
    editor!.commands.setContent('<p>Introduction</p><ul><li><p>Item one</p></li></ul><p>Conclusion</p>');
    const doc = editor!.state.doc;

    const components = extractComponents(doc, generateContentHash);

    expect(components).toHaveLength(3);
    expect(components[0].content).toBe('Introduction');
    expect(components[1].content).toBe('- Item one');
    expect(components[2].content).toBe('Conclusion');
  });

  it('should maintain sequential component numbering with lists', () => {
    editor!.commands.setContent('<p>C1</p><ul><li><p>C2</p></li><li><p>C3</p></li></ul><p>C4</p>');
    const doc = editor!.state.doc;

    const components = extractComponents(doc, generateContentHash);

    expect(components[0].number).toBe(1);
    expect(components[1].number).toBe(2);
    expect(components[2].number).toBe(3);
    expect(components[3].number).toBe(4);
  });
});

describe('isComponentParagraph', () => {
  it('returns true for normal paragraphs', () => {
    expect(isComponentParagraph('This is content')).toBe(true);
  });

  it('returns false for [[HEADER]] paragraphs', () => {
    expect(isComponentParagraph('[[INTRO]]')).toBe(false);
    expect(isComponentParagraph('[[SECTION 1]]')).toBe(false);
  });

  it('handles whitespace around headers', () => {
    expect(isComponentParagraph('  [[HEADER]]  ')).toBe(false);
  });

  it('returns true for paragraphs containing [[HEADER]] as part of content', () => {
    expect(isComponentParagraph('This mentions [[HEADER]] in text')).toBe(true);
  });
});
