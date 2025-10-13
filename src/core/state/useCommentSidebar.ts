/**
 * useCommentSidebar.ts - Comprehensive Comment Sidebar State Hook
 *
 * CONSTITUTIONAL MANDATE: Step 2.2.2-REVISED
 * Extract ALL business logic from CommentSidebar.tsx (~515 LOC) to enable <300 LOC component
 *
 * Architecture:
 * - Absorbs: useScriptCommentsQuery, useCommentMutations, useAuth
 * - Extracts: Realtime logic, threading, filtering, form state, mutation handlers
 * - Preserves: Gap G6 error handling (retry + user-friendly messages)
 * - Provides: Pure data + callbacks for component consumption
 *
 * Complexity: ~900 LOC (business logic layer)
 * Component: <300 LOC (pure UI consumer)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCommentMutations } from './useCommentMutations';
import { useScriptCommentsQuery } from './useScriptCommentsQuery';
import { Logger } from '../../services/logger';
import { useErrorHandling, getUserFriendlyErrorMessage } from '../../utils/errorHandling';
import {
  createComment as createCommentInDB,
  updateComment
} from '../../lib/comments';
import type { CommentWithUser, CommentThread, CreateCommentData } from '../../types/comments';

// Types extracted from CommentSidebar
export type FilterMode = 'all' | 'open' | 'resolved';
export type ConnectionStatus = 'connected' | 'reconnecting' | 'degraded';

export interface CommentSidebarHookProps {
  scriptId: string;
  createComment?: {
    startPosition: number;
    endPosition: number;
    selectedText: string;
  } | null;
  onCommentCreated?: (commentData: CreateCommentData) => void;
  onCommentCancelled?: () => void;
  onCommentDeleted?: (commentId: string) => void;
}

export interface CommentThreadWithNumber extends CommentThread {
  commentNumber: number;
}

/**
 * Comprehensive sidebar hook - encapsulates ALL comment sidebar logic
 *
 * Returns:
 * - Data: threads, loading, error, connectionStatus
 * - State: filterMode, form states (reply, edit, delete)
 * - Mutations: create, reply, edit, delete, resolve (with Gap G6 error handling)
 * - Permissions: canDeleteComment, canEditComment
 */
export function useCommentSidebar({
  scriptId,
  createComment,
  onCommentCreated,
  onCommentCancelled,
  onCommentDeleted
}: CommentSidebarHookProps) {
  const { currentUser } = useAuth();
  const { executeWithErrorHandling } = useErrorHandling('comment operations');
  const queryClient = useQueryClient();

  // ========== EXISTING HOOKS ==========
  // Absorb: Data fetching and mutations
  const commentsQuery = useScriptCommentsQuery(scriptId);
  const comments = useMemo(() => commentsQuery.data || [], [commentsQuery.data]);
  const loading = commentsQuery.isLoading;
  const queryError = commentsQuery.error
    ? getUserFriendlyErrorMessage(commentsQuery.error, { operation: 'load', resource: 'comments' })
    : null;

  const { resolveMutation, unresolveMutation, deleteMutation } = useCommentMutations();

  // ========== STATE MANAGEMENT ==========
  // Extract: ALL useState from component (lines 70-101 from CommentSidebar)

  // Mutation error state (prioritized over query error)
  const [mutationError, setMutationError] = useState<string | null>(null);
  const error = mutationError || queryError;

  // Filter mode
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Connection state for realtime resilience
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [reconnectionTimer, setReconnectionTimer] = useState<NodeJS.Timeout | null>(null);
  const reconnectionAttemptsRef = useRef(0);

  // Comment creation form state
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Universal comment form state
  const [showUniversalForm, setShowUniversalForm] = useState(false);

  // Reply functionality state
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Edit functionality state
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete functionality state
  const [deleteConfirming, setDeleteConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // User profile cache (prevents N+1 queries)
  const userProfileCacheRef = useRef<Map<string, {
    id: string;
    email: string;
    displayName: string | null;
    role: string | null;
  }>>(new Map());

  // Clear cache when scriptId changes (memory leak prevention)
  useEffect(() => {
    userProfileCacheRef.current.clear();
    Logger.info('User profile cache cleared', { scriptId });
  }, [scriptId]);

  // ========== REALTIME SUBSCRIPTION ==========
  // Extract: Lines 148-364 from CommentSidebar (~208 LOC)
  // Preserves: Gap G6 error handling (exponential backoff, connection resilience)

  // Fetch user profile with caching
  const fetchUserProfileCached = useCallback(async (userId: string) => {
    const cached = userProfileCacheRef.current.get(userId);
    if (cached) return cached;

    try {
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, role')
        .eq('id', userId)
        .single();

      if (userError) {
        Logger.error('Failed to fetch user profile', { error: userError, userId });
        return null;
      }

      const profileData = {
        id: userProfile.id,
        email: userProfile.email,
        displayName: userProfile.display_name,
        role: userProfile.role
      };
      userProfileCacheRef.current.set(userId, profileData);

      return profileData;
    } catch (err) {
      Logger.error('Exception fetching user profile', { error: err, userId });
      return null;
    }
  }, []);

  // Realtime subscription effect
  // Critical-Engineer: consulted for dependency array stability (Issue #2)
  // Excludes commentsQuery object to prevent subscription churn on query state changes
  useEffect(() => {
    if (!scriptId) return;

    const isCancelledRef = { current: false };

    const channel = supabase
      .channel(`comments:${scriptId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
        },
        async (payload) => {
          // Refetch comments on any change
          await commentsQuery.refetch();

          // Handle different event types
          if (payload.eventType === 'INSERT') {
            const commentData = payload.new as {
              id: string;
              script_id: string;
              user_id: string;
              content: string;
              start_position: number;
              end_position: number;
              highlighted_text: string | null;
              parent_comment_id: string | null;
              resolved_at: string | null;
              resolved_by: string | null;
              created_at: string;
              updated_at: string;
            };

            if (commentData.script_id !== scriptId) return;

            try {
              const userProfile = await fetchUserProfileCached(commentData.user_id);
              const commentWithUser: CommentWithUser = {
                id: commentData.id,
                scriptId: commentData.script_id,
                userId: commentData.user_id,
                content: commentData.content,
                startPosition: commentData.start_position,
                endPosition: commentData.end_position,
                highlightedText: commentData.highlighted_text || undefined,
                parentCommentId: commentData.parent_comment_id,
                resolvedAt: commentData.resolved_at,
                resolvedBy: commentData.resolved_by,
                createdAt: commentData.created_at,
                updatedAt: commentData.updated_at,
                user: userProfile || undefined
              };

              Logger.info('Realtime comment added', { commentId: commentWithUser.id });
            } catch (err) {
              Logger.error('Failed to enrich realtime comment', { error: err, commentId: commentData.id });
            }
          } else if (payload.eventType === 'UPDATE') {
            const commentData = payload.new as {
              id: string;
              script_id: string;
              user_id: string;
              content: string;
              start_position: number;
              end_position: number;
              highlighted_text: string | null;
              parent_comment_id: string | null;
              resolved_at: string | null;
              resolved_by: string | null;
              created_at: string;
              updated_at: string;
            };

            if (commentData.script_id !== scriptId) return;

            try {
              const userProfile = await fetchUserProfileCached(commentData.user_id);
              const commentWithUser: CommentWithUser = {
                id: commentData.id,
                scriptId: commentData.script_id,
                userId: commentData.user_id,
                content: commentData.content,
                startPosition: commentData.start_position,
                endPosition: commentData.end_position,
                highlightedText: commentData.highlighted_text || undefined,
                parentCommentId: commentData.parent_comment_id,
                resolvedAt: commentData.resolved_at,
                resolvedBy: commentData.resolved_by,
                createdAt: commentData.created_at,
                updatedAt: commentData.updated_at,
                user: userProfile || undefined
              };

              Logger.info('Realtime comment updated', { commentId: commentWithUser.id });
            } catch (err) {
              Logger.error('Failed to enrich realtime update', { error: err, commentId: commentData.id });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedComment = payload.old as { id: string };
            Logger.info('Realtime comment deleted', { commentId: deletedComment.id });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          Logger.info('Realtime channel subscribed', { scriptId });
          setConnectionStatus('connected');
          reconnectionAttemptsRef.current = 0;
          if (reconnectionTimer) {
            clearTimeout(reconnectionTimer);
            setReconnectionTimer(null);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const eventType = status === 'CHANNEL_ERROR' ? 'error' : status === 'TIMED_OUT' ? 'timeout' : 'closed';
          Logger.warn(`Realtime channel ${eventType}`, { scriptId });

          reconnectionAttemptsRef.current += 1;
          const nextAttempt = reconnectionAttemptsRef.current;

          if (nextAttempt >= 4) {
            Logger.error('Realtime connection degraded after 4 failed attempts', { scriptId });
            setConnectionStatus('degraded');
            return;
          }

          setConnectionStatus('reconnecting');

          const baseDelay = Math.pow(2, nextAttempt) * 1000;
          const jitter = Math.random() * 500;
          const delay = baseDelay + jitter;

          Logger.info(`Scheduling reconnection attempt ${nextAttempt}`, {
            scriptId,
            delayMs: Math.round(delay)
          });

          const timer = setTimeout(() => {
            if (isCancelledRef.current) {
              Logger.info('Reconnection cancelled (component unmounted)', { scriptId });
              return;
            }

            Logger.info(`Executing reconnection attempt ${nextAttempt}`, { scriptId });
            channel.subscribe();
          }, delay);

          setReconnectionTimer(timer);
        }
      });

    return () => {
      isCancelledRef.current = true;
      Logger.info('Unsubscribing from realtime channel', { scriptId });
      if (reconnectionTimer) {
        clearTimeout(reconnectionTimer);
      }
      channel.unsubscribe();
    };
    // Intentionally exclude unstable dependencies:
    // - reconnectionTimer: prevents infinite loop
    // - commentsQuery: prevents subscription churn (refetch() method is stable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId, fetchUserProfileCached]);

  // ========== THREADING & FILTERING ==========
  // Extract: Lines 366-409 from CommentSidebar (~43 LOC)

  const threads = useMemo((): CommentThreadWithNumber[] => {
    // Filter by resolved status
    const filteredComments = comments.filter(comment => {
      if (filterMode === 'open') {
        return !comment.resolvedAt;
      } else if (filterMode === 'resolved') {
        return !!comment.resolvedAt;
      }
      return true; // 'all'
    });

    // Group into threads with numbering
    const commentThreads: CommentThreadWithNumber[] = [];
    const threadMap = new Map<string, CommentThreadWithNumber>();

    // Collect parent comments sorted by position
    const parentComments = filteredComments
      .filter(comment => !comment.parentCommentId)
      .sort((a, b) => a.startPosition - b.startPosition);

    parentComments.forEach((comment, index) => {
      const thread: CommentThreadWithNumber = {
        id: comment.id,
        parentComment: comment,
        replies: [],
        isResolved: !!comment.resolvedAt,
        replyCount: 0,
        commentNumber: index + 1, // Sequential numbering
      };
      threadMap.set(comment.id, thread);
      commentThreads.push(thread);
    });

    // Add replies to parent threads
    filteredComments.forEach(comment => {
      if (comment.parentCommentId) {
        const parentThread = threadMap.get(comment.parentCommentId);
        if (parentThread) {
          parentThread.replies.push(comment);
          parentThread.replyCount++;
        }
      }
    });

    return commentThreads;
  }, [comments, filterMode]);

  // ========== MUTATION HANDLERS ==========
  // Extract: Lines 410-667 from CommentSidebar (~257 LOC)
  // Preserves: Gap G6 error handling (executeWithErrorHandling + getUserFriendlyErrorMessage)

  // Create comment
  const handleCreateComment = useCallback(async () => {
    if (!createComment || !commentText.trim() || !currentUser) return;

    if (scriptId.startsWith('readonly-')) return;

    setSubmitting(true);
    setMutationError(null);

    const commentData: CreateCommentData = {
      scriptId,
      content: commentText.trim(),
      startPosition: createComment.startPosition,
      endPosition: createComment.endPosition,
      parentCommentId: null,
      highlightedText: DOMPurify.sanitize(createComment.selectedText, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
      }),
    };

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optimisticComment: CommentWithUser = {
      id: tempId,
      scriptId,
      userId: currentUser.id,
      content: commentData.content,
      startPosition: commentData.startPosition,
      endPosition: commentData.endPosition,
      highlightedText: commentData.highlightedText,
      parentCommentId: null,
      resolvedAt: null,
      resolvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        id: currentUser.id,
        email: currentUser.email!,
        displayName: currentUser.user_metadata?.display_name || null
      }
    };

    // Use per-user cache key (security fix 6921df2)
    const cacheKey = ['comments', scriptId, currentUser.id];

    queryClient.setQueryData<CommentWithUser[]>(
      cacheKey,
      (oldComments = []) => [...oldComments, optimisticComment]
    );

    const result = await executeWithErrorHandling(
      async () => {
        const response = await createCommentInDB(supabase, commentData, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to create comment');
        }

        queryClient.setQueryData<CommentWithUser[]>(
          cacheKey,
          (oldComments = []) =>
            oldComments.map(c => c.id === tempId ? response.data! : c)
        );

        return response.data;
      },
      (errorInfo) => {
        queryClient.setQueryData<CommentWithUser[]>(
          cacheKey,
          (oldComments = []) => oldComments.filter(c => c.id !== tempId)
        );

        const contextualMessage = getUserFriendlyErrorMessage(
          new Error(errorInfo.message),
          { operation: 'create', resource: 'comment' }
        );
        setMutationError(contextualMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      setCommentText('');
      if (onCommentCreated) {
        onCommentCreated(commentData);
      }
    }

    setSubmitting(false);
  }, [createComment, commentText, currentUser, scriptId, queryClient, executeWithErrorHandling, onCommentCreated]);

  const handleCancelComment = useCallback(() => {
    setCommentText('');
    if (onCommentCancelled) {
      onCommentCancelled();
    }
  }, [onCommentCancelled]);

  // Create universal comment (script-level, not tied to specific text)
  const handleCreateUniversalComment = useCallback(async () => {
    if (!commentText.trim() || !currentUser) return;

    if (scriptId.startsWith('readonly-')) return;

    setSubmitting(true);
    setMutationError(null);

    const commentData: CreateCommentData = {
      scriptId,
      content: commentText.trim(),
      startPosition: 0,
      endPosition: 0,
      parentCommentId: null,
      highlightedText: undefined,
    };

    const result = await executeWithErrorHandling(
      async () => {
        const response = await createCommentInDB(supabase, commentData, currentUser.id);
        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to create comment');
        }
        return response.data;
      },
      (errorInfo) => {
        setMutationError(errorInfo.userMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      setCommentText('');
      setShowUniversalForm(false);
      await commentsQuery.refetch();
    }

    setSubmitting(false);
  }, [commentText, currentUser, scriptId, executeWithErrorHandling, commentsQuery]);

  // Reply handlers
  const handleReplyClick = useCallback((commentId: string) => {
    setReplyingTo(commentId);
    setReplyText('');
  }, []);

  const handleReplySubmit = useCallback(async (parentCommentId: string) => {
    if (!replyText.trim() || !currentUser) return;

    setSubmittingReply(true);
    setMutationError(null);

    const parentComment = comments.find(c => c.id === parentCommentId);

    const replyData: CreateCommentData = {
      scriptId,
      content: replyText.trim(),
      startPosition: parentComment?.startPosition || 0,
      endPosition: parentComment?.endPosition || 0,
      parentCommentId,
    };

    const result = await executeWithErrorHandling(
      async () => {
        const response = await createCommentInDB(supabase, replyData, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to create reply');
        }

        return response.data;
      },
      (errorInfo) => {
        const contextualMessage = getUserFriendlyErrorMessage(
          new Error(errorInfo.message),
          { operation: 'reply', resource: 'reply' }
        );
        setMutationError(contextualMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      setReplyingTo(null);
      setReplyText('');
    }

    setSubmittingReply(false);
  }, [replyText, currentUser, scriptId, comments, executeWithErrorHandling]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyText('');
  }, []);

  // Resolve/unresolve handlers
  const handleResolveToggle = useCallback(async (commentId: string, isCurrentlyResolved: boolean) => {
    if (!currentUser) return;

    setMutationError(null);

    const operation = isCurrentlyResolved ? 'unresolve' : 'resolve';
    const mutationOptions = {
      onError: (error: Error) => {
        const contextualMessage = getUserFriendlyErrorMessage(
          error,
          { operation, resource: 'comment' }
        );
        setMutationError(contextualMessage);
      }
    };

    if (isCurrentlyResolved) {
      unresolveMutation.mutate({ commentId, scriptId }, mutationOptions);
    } else {
      resolveMutation.mutate({ commentId, scriptId }, mutationOptions);
    }
  }, [currentUser, scriptId, resolveMutation, unresolveMutation]);

  // Delete handlers
  const handleDeleteClick = useCallback((commentId: string) => {
    setDeleteConfirming(commentId);
  }, []);

  const handleDeleteConfirm = useCallback(async (commentId: string) => {
    if (!currentUser) return;

    setDeleting(true);
    setMutationError(null);

    deleteMutation.mutate(
      { commentId, scriptId },
      {
        onSuccess: () => {
          if (onCommentDeleted) {
            onCommentDeleted(commentId);
          }
          setDeleteConfirming(null);
          setDeleting(false);
        },
        onError: (error) => {
          const contextualMessage = getUserFriendlyErrorMessage(
            error as Error,
            { operation: 'delete', resource: 'comment' }
          );
          setMutationError(contextualMessage);
          setDeleting(false);
        }
      }
    );
  }, [currentUser, scriptId, deleteMutation, onCommentDeleted]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirming(null);
  }, []);

  // Edit handlers
  const handleEditClick = useCallback((comment: CommentWithUser) => {
    setEditing(comment.id);
    setEditText(comment.content);
  }, []);

  const handleEditSubmit = useCallback(async (commentId: string) => {
    if (!editText.trim() || !currentUser) return;

    setSubmittingEdit(true);
    setMutationError(null);

    const result = await executeWithErrorHandling(
      async () => {
        const response = await updateComment(supabase, commentId, { content: editText.trim() }, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to update comment');
        }

        return response.data;
      },
      (errorInfo) => {
        const contextualMessage = getUserFriendlyErrorMessage(
          new Error(errorInfo.message),
          { operation: 'update', resource: 'comment' }
        );
        setMutationError(contextualMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      setEditing(null);
      setEditText('');
    }

    setSubmittingEdit(false);
  }, [editText, currentUser, executeWithErrorHandling]);

  const handleEditCancel = useCallback(() => {
    setEditing(null);
    setEditText('');
  }, []);

  // ========== PERMISSIONS ==========
  // Extract: Lines 697-705 from CommentSidebar

  const canDeleteComment = useCallback((comment: CommentWithUser) => {
    return currentUser && comment.userId === currentUser.id;
  }, [currentUser]);

  const canEditComment = useCallback((comment: CommentWithUser) => {
    return currentUser && comment.userId === currentUser.id;
  }, [currentUser]);

  // ========== RETURN INTERFACE ==========
  // Pure data + callbacks for component consumption
  return {
    // Data
    threads,
    loading,
    error,

    // Connection state
    connectionStatus,

    // Filter state
    filterMode,
    setFilterMode,

    // Comment creation state
    commentText,
    setCommentText,
    submitting,
    handleCreateComment,
    handleCancelComment,

    // Universal comment state
    showUniversalForm,
    setShowUniversalForm,
    handleCreateUniversalComment,

    // Reply state
    replyingTo,
    setReplyingTo,
    replyText,
    setReplyText,
    submittingReply,
    handleReplyClick,
    handleReplySubmit,
    handleCancelReply,

    // Edit state
    editing,
    setEditing,
    editText,
    setEditText,
    submittingEdit,
    handleEditClick,
    handleEditSubmit,
    handleEditCancel,

    // Delete state
    deleteConfirming,
    setDeleteConfirming,
    deleting,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleDeleteClick,

    // Resolve state
    handleResolveToggle,

    // Permissions
    canDeleteComment,
    canEditComment,

    // Error management
    setMutationError,
  };
}
