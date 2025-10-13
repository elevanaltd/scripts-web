import { describe, it, expect } from 'vitest';
import { extractComponents, isComponentParagraph } from './componentExtraction';
import { generateContentHash } from '../services/scriptService';
import { schema } from '@tiptap/pm/schema-basic';

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
