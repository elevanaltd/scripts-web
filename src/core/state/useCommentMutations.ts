import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createComment, updateComment, resolveComment, unresolveComment, deleteComment } from '../../lib/comments'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useCommentStore } from '../stores/commentStore'
import type { CreateCommentData, CommentWithRecovery } from '../../types/comments'

// Critical-Engineer: consulted for mutation architecture with Supabase integration
// Architecture: TanStack Query mutations for comment CRUD operations
// Gap #2 & #5 Resolution: Wired mutations to commentStore for optimistic UX (Phase 2.95B)
// Testguard consulted: Tests exist at useCommentMutations.test.tsx (co-located)

interface UpdateCommentParams {
  commentId: string
  content: string
}

interface ResolveCommentParams {
  commentId: string
  scriptId: string
}

/**
 * Hook for comment mutations (create, update, resolve, unresolve, delete)
 *
 * Architecture compliance:
 * - Named mutation keys for React Query DevTools
 * - Cache invalidation on success
 * - Error handling with proper propagation
 */
export const useCommentMutations = () => {
  const queryClient = useQueryClient()
  const { currentUser, userProfile } = useAuth()

  // Testguard consulted: Gap #2 & #5 - optimistic comment UX with store coordination
  const createMutation = useMutation({
    mutationKey: ['createComment'],
    mutationFn: async (data: CreateCommentData) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated')
      }

      const result = await createComment(supabase, data, currentUser.id)

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to create comment')
      }

      return result.data
    },
    onMutate: async (variables) => {
      // Gap #2 & #5: Track optimistic comment with full payload
      const tempId = `temp-${Date.now()}-${Math.random()}`
      const store = useCommentStore.getState()

      store.trackOptimisticComment(tempId, {
        tempId,
        scriptId: variables.scriptId,
        content: variables.content,
        startPosition: variables.startPosition,
        endPosition: variables.endPosition,
        highlightedText: variables.highlightedText,
        parentCommentId: variables.parentCommentId || null,
        userId: currentUser!.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      store.setSubmittingStatus(tempId, true)

      return { tempId }
    },
    onSuccess: (data, variables, context) => {
      // Gap #2: Resolve optimistic comment to real ID
      if (context?.tempId) {
        const store = useCommentStore.getState()
        store.resolveOptimisticComment(context.tempId, data.id)
        store.setSubmittingStatus(context.tempId, false)
      }

      // Invalidate comments cache to refetch
      queryClient.invalidateQueries({
        queryKey: ['comments']
      })
    },
    onError: (error, variables, context) => {
      // Gap #2: Remove failed optimistic comment
      if (context?.tempId) {
        const store = useCommentStore.getState()
        store.removeOptimisticComment(context.tempId)
        store.setSubmittingStatus(context.tempId, false)
      }

      console.error('Comment creation failed:', error)
    },
  })

  const updateMutation = useMutation({
    mutationKey: ['updateComment'],
    mutationFn: async ({ commentId, content }: UpdateCommentParams) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated')
      }

      const result = await updateComment(supabase, commentId, { content }, currentUser.id)

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to update comment')
      }

      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['comments']
      })
    },
  })

  const resolveMutation = useMutation({
    mutationKey: ['resolveComment'],
    mutationFn: async ({ commentId }: ResolveCommentParams) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated')
      }

      const result = await resolveComment(supabase, commentId, currentUser.id)

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to resolve comment')
      }

      return result.data
    },
    onMutate: async ({ commentId, scriptId }) => {
      // Gap G2: Optimistic UI update for comment resolution
      // P1 Fix (2025-10-10): Include userId for per-user cache isolation
      const queryKey = ['comments', scriptId, currentUser?.id] as const

      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current cache for this specific script
      const previousComments = queryClient.getQueryData<CommentWithRecovery[]>(queryKey)

      // Optimistically update comment cache for this script
      const now = new Date().toISOString()
      queryClient.setQueryData<CommentWithRecovery[]>(queryKey, (old) => {
        if (!Array.isArray(old)) return old

        return old.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                resolvedAt: now,
                resolvedBy: currentUser?.id || null,
                resolvedByUser: currentUser ? {
                  id: currentUser.id,
                  email: currentUser.email || '',
                  displayName: userProfile?.display_name || null,
                } : null,
              }
            : comment
        )
      })

      return { previousComments, queryKey }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['comments', variables.scriptId]
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback comment cache to previous state
      if (context?.previousComments && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousComments)
      }
    },
  })

  const unresolveMutation = useMutation({
    mutationKey: ['unresolveComment'],
    mutationFn: async ({ commentId }: ResolveCommentParams) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated')
      }

      const result = await unresolveComment(supabase, commentId, currentUser.id)

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to unresolve comment')
      }

      return result.data
    },
    onMutate: async ({ commentId, scriptId }) => {
      // Gap G2: Optimistic UI update for comment unresolve
      // P1 Fix (2025-10-10): Include userId for per-user cache isolation
      const queryKey = ['comments', scriptId, currentUser?.id] as const

      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current cache for this specific script
      const previousComments = queryClient.getQueryData<CommentWithRecovery[]>(queryKey)

      // Optimistically update comment cache for this script
      queryClient.setQueryData<CommentWithRecovery[]>(queryKey, (old) => {
        if (!Array.isArray(old)) return old

        return old.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                resolvedAt: null,
                resolvedBy: null,
                resolvedByUser: null,
              }
            : comment
        )
      })

      return { previousComments, queryKey }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['comments', variables.scriptId]
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback comment cache to previous state
      if (context?.previousComments && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousComments)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationKey: ['deleteComment'],
    mutationFn: async ({ commentId }: ResolveCommentParams) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated')
      }

      const result = await deleteComment(supabase, commentId, currentUser.id)

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete comment')
      }

      return result.success
    },
    onMutate: async ({ commentId, scriptId }) => {
      // Gap G2: Optimistic UI update for comment deletion
      // P1 Fix (2025-10-10): Include userId for per-user cache isolation
      const queryKey = ['comments', scriptId, currentUser?.id] as const

      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current cache for this specific script
      const previousComments = queryClient.getQueryData<CommentWithRecovery[]>(queryKey)

      // Optimistically remove comment from cache for this script
      queryClient.setQueryData<CommentWithRecovery[]>(queryKey, (old) => {
        if (!Array.isArray(old)) return old

        return old.filter((comment) => comment.id !== commentId)
      })

      return { previousComments, queryKey }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['comments', variables.scriptId]
      })
    },
    onError: (_err, _variables, context) => {
      // Rollback comment cache to previous state
      if (context?.previousComments && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousComments)
      }
    },
  })

  return {
    createMutation,
    updateMutation,
    resolveMutation,
    unresolveMutation,
    deleteMutation,
  }
}
