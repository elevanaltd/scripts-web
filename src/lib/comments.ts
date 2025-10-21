/**
 * Comments CRUD Operations - Phase 2.4 Implementation
 *
 * Google Docs-style commenting system database operations
 * Following ADR-003 architecture requirements
 *
 * Features:
 * - Create, read, update, delete comments
 * - Position-based text anchoring
 * - Threading support for replies
 * - Resolution status management
 * - RLS security enforcement
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@elevanaltd/shared-lib/types';
import type {
  CommentWithUser,
  CommentWithRecovery,
  CreateCommentData,
  CommentFilters,
  CommentError
} from '../types/comments';
import { batchRecoverCommentPositions } from './comments-position-recovery';

// Session-scoped cache for user profiles to avoid repeated queries
const userProfileCache = new Map<string, {
  id: string;
  email: string;
  display_name: string | null;
  role: string | null;
}>();

/**
 * Clear the user profile cache
 * Should be called when changing scripts to prevent memory accumulation
 */
export function clearUserProfileCache(): void {
  userProfileCache.clear();
}

// Result types for consistent API responses
export interface CommentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: CommentError;
}

/**
 * Create a new comment in the database
 */
export async function createComment(
  supabase: SupabaseClient<Database>,
  data: CreateCommentData,
  userId: string
): Promise<CommentResult<CommentWithUser>> {
  try {
    // Validate input data
    const validationError = validateCommentData(data);
    if (validationError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError
        }
      };
    }

    // Insert comment into database
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        script_id: data.scriptId,
        user_id: userId,
        content: data.content,
        start_position: data.startPosition,
        end_position: data.endPosition,
        parent_comment_id: data.parentCommentId,
        highlighted_text: data.highlightedText || '', // Store text for position recovery
      })
      .select(`
        *,
        user:user_profiles(id, email, display_name, role)
      `)
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error.message,
          details: error
        }
      };
    }

    // Transform to application format
    const commentWithUser: CommentWithUser = {
      id: comment.id,
      scriptId: comment.script_id,
      userId: comment.user_id,
      content: comment.content,
      startPosition: comment.start_position,
      endPosition: comment.end_position,
      highlightedText: comment.highlighted_text,
      parentCommentId: comment.parent_comment_id,
      resolvedAt: comment.resolved_at,
      resolvedBy: comment.resolved_by,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: Array.isArray(comment.user) && comment.user.length > 0 ? comment.user[0] : comment.user || undefined
    };

    return {
      success: true,
      data: commentWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Get comments for a script with optional filtering and position recovery
 * @param documentContent - Current document content for position recovery (optional)
 */
export async function getComments(
  supabase: SupabaseClient<Database>,
  scriptId: string,
  filters?: CommentFilters,
  documentContent?: string
): Promise<CommentResult<CommentWithRecovery[]>> {
  try {
    let query = supabase
      .from('comments')
      .select(`
        id,
        script_id,
        user_id,
        content,
        start_position,
        end_position,
        highlighted_text,
        parent_comment_id,
        resolved_at,
        resolved_by,
        created_at,
        updated_at
      `)
      .eq('script_id', scriptId)
      .eq('deleted', false) // Only non-deleted comments
      .order('start_position', { ascending: true });

    // Apply filters
    if (filters?.resolved !== undefined && filters.resolved !== null) {
      if (filters.resolved) {
        query = query.not('resolved_at', 'is', null);
      } else {
        query = query.is('resolved_at', null);
      }
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    const { data: comments, error } = await query;

    if (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error.message,
          details: error
        }
      };
    }

    // PERFORMANCE OPTIMIZATION: Single query for all user profiles instead of N+1

    // Step 1: Extract unique user IDs from comments
    const userIds = [...new Set((comments || []).flatMap(comment => [comment.user_id, comment.resolved_by]).filter(Boolean) as string[])];

    // Step 2: Fetch user profiles with caching - only query uncached profiles
    const userProfilesMap = new Map<string, { id: string; email: string; display_name: string | null; role: string | null }>();

    if (userIds.length > 0) {
      // Check cache first and identify missing profiles
      const uncachedUserIds: string[] = [];

      for (const userId of userIds) {
        if (userProfileCache.has(userId)) {
          // Use cached profile
          const cachedProfile = userProfileCache.get(userId);
          if (cachedProfile) {
            userProfilesMap.set(userId, cachedProfile);
          }
        } else {
          // Mark for database query
          uncachedUserIds.push(userId);
        }
      }

      // Single query for uncached profiles only
      if (uncachedUserIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from('user_profiles')
          .select('id, email, display_name, role')
          .in('id', uncachedUserIds);

        // Step 3: Update both cache and working map
        (userProfiles || []).forEach(profile => {
          const profileData = {
            id: profile.id,
            email: profile.email,
            display_name: profile.display_name,
            role: profile.role
          };

          // Cache for future use
          userProfileCache.set(profile.id, profileData);

          // Add to working map for current request
          userProfilesMap.set(profile.id, profileData);
        });
      }
    }

    // Step 4: Transform to application format with efficient user lookup
    const commentsWithUser: CommentWithUser[] = (comments || []).map(comment => {
      const userProfile = userProfilesMap.get(comment.user_id);
      const resolvedByProfile = comment.resolved_by ? userProfilesMap.get(comment.resolved_by) : null;

      return {
        id: comment.id,
        scriptId: comment.script_id,
        userId: comment.user_id,
        content: comment.content,
        startPosition: comment.start_position,
        endPosition: comment.end_position,
        highlightedText: comment.highlighted_text,
        parentCommentId: comment.parent_comment_id,
        resolvedAt: comment.resolved_at,
        resolvedBy: comment.resolved_by,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        user: userProfile ? {
          id: userProfile.id,
          email: userProfile.email,
          displayName: userProfile.display_name,
          role: userProfile.role
        } : undefined,
        resolvedByUser: resolvedByProfile ? {
          id: resolvedByProfile.id,
          email: resolvedByProfile.email,
          displayName: resolvedByProfile.display_name,
          role: resolvedByProfile.role
        } : null,
      };
    });

    // Step 5: Apply position recovery if document content provided
    if (documentContent) {
      const recoveryResults = batchRecoverCommentPositions(
        commentsWithUser.map(c => ({
          id: c.id,
          startPosition: c.startPosition,
          endPosition: c.endPosition,
          highlighted_text: c.highlightedText || '',
          created_at: c.createdAt // CRITICAL FIX: Pass created_at for fresh comment detection
        })),
        documentContent
      );

      // Step 5a: Persist recovered positions to database
      const positionsToUpdate: Array<{ id: string; start_position: number; end_position: number }> = [];

      for (const [commentId, recovery] of recoveryResults.entries()) {
        if (recovery.status === 'relocated') {
          positionsToUpdate.push({
            id: commentId,
            start_position: recovery.newStartPosition,
            end_position: recovery.newEndPosition
          });
        }
      }

      // Batch update all recovered positions using Promise.allSettled for error resilience
      if (positionsToUpdate.length > 0) {
        const results = await Promise.allSettled(
          positionsToUpdate.map(update =>
            supabase
              .from('comments')
              .update({
                start_position: update.start_position,
                end_position: update.end_position,
                updated_at: new Date().toISOString()
              })
              .eq('id', update.id)
          )
        );

        // Log failures without blocking comment retrieval
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
          console.error(`Position recovery: ${failed.length}/${positionsToUpdate.length} updates failed`,
            failed.map((r, i) => ({
              commentId: positionsToUpdate[i].id,
              error: r.status === 'rejected' ? r.reason : null
            }))
          );
        }
      }

      const commentsWithRecovery: CommentWithRecovery[] = commentsWithUser.map(comment => {
        const recovery = recoveryResults.get(comment.id);
        if (recovery) {
          // Update positions if relocated
          return {
            ...comment,
            startPosition: recovery.newStartPosition,
            endPosition: recovery.newEndPosition,
            recovery: recovery
          };
        }
        return comment;
      });

      return {
        success: true,
        data: commentsWithRecovery
      };
    }

    // No position recovery - return comments as-is
    return {
      success: true,
      data: commentsWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Update a comment's content
 */
export async function updateComment(
  supabase: SupabaseClient<Database>,
  commentId: string,
  updates: { content?: string },
  userId: string
): Promise<CommentResult<CommentWithUser>> {
  try {
    // Validate content if provided
    if (updates.content !== undefined) {
      const validation = validateContent(updates.content);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error!
          }
        };
      }
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .update({
        content: updates.content,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .eq('user_id', userId)
      .select('*, user:user_profiles(id, email, display_name, role)')
      .maybeSingle();

    if (error) {
      return { success: false, error: { code: 'DATABASE_ERROR', message: error.message, details: error } };
    }

    if (!comment) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Comment not found or you do not have permission to edit it'
        }
      };
    }

    const commentWithUser: CommentWithUser = {
      ...comment,
      scriptId: comment.script_id,
      userId: comment.user_id,
      startPosition: comment.start_position,
      endPosition: comment.end_position,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: Array.isArray(comment.user) && comment.user.length > 0 ? comment.user[0] : comment.user || undefined
    };

    return {
      success: true,
      data: commentWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Resolve a comment (mark as resolved)
 */
export async function resolveComment(
  supabase: SupabaseClient<Database>,
  commentId: string,
  userId: string
): Promise<CommentResult<CommentWithUser>> {
  try {
    const resolvedAt = new Date().toISOString();

    const { data: comment, error } = await supabase
      .from('comments')
      .update({ resolved_at: resolvedAt, resolved_by: userId, updated_at: resolvedAt })
      .eq('id', commentId)
      .select('*, user:user_profiles(id, email, display_name, role)')
      .single();

    if (error) {
      return { success: false, error: { code: 'DATABASE_ERROR', message: error.message, details: error } };
    }

    const commentWithUser: CommentWithUser = {
      ...comment,
      scriptId: comment.script_id,
      userId: comment.user_id,
      startPosition: comment.start_position,
      endPosition: comment.end_position,
      resolvedAt: comment.resolved_at,
      resolvedBy: comment.resolved_by,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: Array.isArray(comment.user) && comment.user.length > 0 ? comment.user[0] : comment.user || undefined
    };

    return {
      success: true,
      data: commentWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Unresolve a comment (mark as unresolved)
 */
export async function unresolveComment(
  supabase: SupabaseClient<Database>,
  commentId: string,
  _userId: string
): Promise<CommentResult<CommentWithUser>> {
  try {
    const updatedAt = new Date().toISOString();

    const { data: comment, error } = await supabase
      .from('comments')
      .update({ resolved_at: null, resolved_by: null, updated_at: updatedAt })
      .eq('id', commentId)
      .select('*, user:user_profiles(id, email, display_name, role)')
      .single();

    if (error) {
      return { success: false, error: { code: 'DATABASE_ERROR', message: error.message, details: error } };
    }

    const commentWithUser: CommentWithUser = {
      ...comment,
      scriptId: comment.script_id,
      userId: comment.user_id,
      startPosition: comment.start_position,
      endPosition: comment.end_position,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: Array.isArray(comment.user) && comment.user.length > 0 ? comment.user[0] : comment.user || undefined
    };

    return {
      success: true,
      data: commentWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * CASCADE SOFT DELETE - Delete comment and all descendant comments
 * Maintains thread integrity by preventing orphaned replies
 */
export async function deleteComment(
  supabase: SupabaseClient<Database>,
  commentId: string,
  userId: string
): Promise<CommentResult<boolean>> {
  try {
    // First verify the user owns the parent comment
    const { data: parentComment, error: parentError } = await supabase
      .from('comments')
      .select('id, user_id')
      .eq('id', commentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (parentError) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to verify comment ownership',
          details: parentError
        }
      };
    }

    if (!parentComment) {
      return {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Comment not found or you do not have permission to delete it'
        }
      };
    }

    // Get all descendants that need to be deleted
    const descendantIds = await getCommentDescendants(supabase, commentId);

    // Create array of all comment IDs to delete (parent + descendants)
    const allIdsToDelete = [commentId, ...descendantIds];

    // Try optimized database function first for better performance
    let updateError = null;
    try {
      const { error: dbFuncError } = await supabase.rpc('cascade_soft_delete_comments', {
        comment_ids: allIdsToDelete
      });
      updateError = dbFuncError;
    } catch (dbError) {
      // Fallback to client-side batch update if database function fails
      console.warn('Database function failed, using client-side update:', dbError);
      const { error: batchError } = await supabase
        .from('comments')
        .update({
          deleted: true,
          updated_at: new Date().toISOString()
        })
        .in('id', allIdsToDelete);
      updateError = batchError;
    }

    if (updateError) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: updateError.message,
          details: updateError
        }
      };
    }

    return {
      success: true,
      data: true
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

/**
 * Get all descendant comment IDs for cascade delete operations
 * Uses optimized database function for single-query recursive descent
 */
async function getCommentDescendants(
  supabase: SupabaseClient<Database>,
  commentId: string
): Promise<string[]> {
  try {
    // Use optimized database function for single-query recursive descent
    const { data, error } = await supabase.rpc('get_comment_descendants', {
      parent_id: commentId
    });

    if (error) {
      throw new Error(`Failed to get comment descendants: ${error.message}`);
    }

    return data ? data.map((row: { id: string }) => row.id) : [];
  } catch (dbError) {
    // Fallback to client-side recursive approach if database function fails
    console.warn('Database function failed, using client-side approach:', dbError);

    const descendants: string[] = [];
    const toProcess: string[] = [commentId];

    while (toProcess.length > 0) {
      const currentBatch = toProcess.splice(0);

      // Get direct children of current batch
      const { data: children, error } = await supabase
        .from('comments')
        .select('id')
        .in('parent_comment_id', currentBatch)
        .eq('deleted', false);

      if (error) {
        throw new Error(`Failed to get comment descendants: ${error.message}`);
      }

      if (children && children.length > 0) {
        const childIds = children.map(child => child.id);
        descendants.push(...childIds);
        toProcess.push(...childIds);
      }
    }

    return descendants;
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function validateCommentData(data: CreateCommentData): string | null {
  if (!data.scriptId || data.scriptId.trim() === '') {
    return 'Script ID is required';
  }

  if (!data.content || data.content.trim() === '') {
    return 'Comment content is required';
  }

  const contentValidation = validateContent(data.content);
  if (!contentValidation.valid) {
    return contentValidation.error!;
  }

  if (data.startPosition < 0) {
    return 'Start position must be non-negative';
  }

  if (data.endPosition <= data.startPosition) {
    return 'End position must be greater than start position';
  }

  return null;
}

function validateContent(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();

  if (trimmed.length < 1) {
    return { valid: false, error: 'Content cannot be empty' };
  }

  if (trimmed.length > 10000) {
    return { valid: false, error: 'Content cannot exceed 10,000 characters' };
  }

  return { valid: true };
}