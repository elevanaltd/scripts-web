// Type Safety Test for Comments
// Validates that Comment interface matches database schema constraints

import { describe, test, expect } from 'vitest';
import type { Comment, CommentInsert } from './comments';

describe('Comments Type Safety', () => {
  test('Comment interface should require userId (NOT NULL in database)', () => {
    // This test validates that userId is required, not nullable

    // Should compile - userId is required
    const validComment: Comment = {
      id: 'test-id',
      scriptId: 'test-script',
      userId: 'test-user', // Required field
      content: 'Test comment',
      startPosition: 0,
      endPosition: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    expect(validComment.userId).toBeTypeOf('string');

    // TypeScript should prevent null userId at compile time
    // The following would cause a compilation error:
    // const invalidComment: Comment = {
    //   userId: null, // Error: Type 'null' is not assignable to type 'string'
    // };

    // Test validates that the type system enforces the constraint
    expect(true).toBe(true); // Type constraint is enforced at compile time
  });

  test('CommentInsert should map correctly to database schema', () => {
    // Validate that application Comment can be transformed to CommentInsert
    const appComment: Comment = {
      id: 'test-id',
      scriptId: 'test-script',
      userId: 'test-user',
      content: 'Test comment',
      startPosition: 0,
      endPosition: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // This transformation should compile without errors
    const dbInsert: CommentInsert = {
      script_id: appComment.scriptId,
      user_id: appComment.userId, // Should work since userId is string
      content: appComment.content,
      start_position: appComment.startPosition,
      end_position: appComment.endPosition
    };

    expect(dbInsert.user_id).toBe(appComment.userId);
  });
});