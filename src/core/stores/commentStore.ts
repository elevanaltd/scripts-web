import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Critical-Engineer: consulted for State management (GAP #1 resolution)
// Architecture: Lines 488-554 - Explicit state coordination for comment UI
// Gap #5 Resolution: Redesigned for full payload optimism (Phase 2.95B)

// Optimistic comment with full payload for rendering
export interface OptimisticComment {
  tempId: string
  scriptId: string
  content: string
  startPosition: number
  endPosition: number
  highlightedText?: string
  parentCommentId?: string | null
  userId: string
  createdAt: string
  updatedAt: string
  // Optional real ID after server confirmation
  realId?: string
}

export interface CommentUISlice {
  // Comment interaction state
  replyingTo: string | null
  editingComment: string | null

  // Full payload optimistic comment tracking (Gap #5 resolution)
  optimisticComments: Map<string, OptimisticComment>
  submittingStatus: Map<string, boolean>

  // State mutations (explicit control - Amendment #1 compliance)
  setReplyingTo: (commentId: string | null) => void
  setEditingComment: (commentId: string | null) => void
  trackOptimisticComment: (tempId: string, payload: OptimisticComment) => void
  resolveOptimisticComment: (tempId: string, realId: string) => void
  removeOptimisticComment: (tempId: string) => void
  setSubmittingStatus: (tempId: string, status: boolean) => void
}

const createCommentUISlice = (
  set: (partial: Partial<CommentUISlice> | ((state: CommentUISlice) => Partial<CommentUISlice>)) => void
): CommentUISlice => ({
  replyingTo: null,
  editingComment: null,
  optimisticComments: new Map(),
  submittingStatus: new Map(),

  setReplyingTo: (commentId) =>
    set((state: CommentUISlice) => ({ ...state, replyingTo: commentId })),

  setEditingComment: (commentId) =>
    set((state: CommentUISlice) => ({ ...state, editingComment: commentId })),

  trackOptimisticComment: (tempId, payload) =>
    set((state: CommentUISlice) => ({
      ...state,
      optimisticComments: new Map(state.optimisticComments).set(tempId, payload),
    })),

  resolveOptimisticComment: (tempId, realId) =>
    set((state: CommentUISlice) => {
      const comment = state.optimisticComments.get(tempId)
      if (!comment) return state

      const updatedComment = { ...comment, realId }
      return {
        ...state,
        optimisticComments: new Map(state.optimisticComments).set(tempId, updatedComment),
      }
    }),

  removeOptimisticComment: (tempId) =>
    set((state: CommentUISlice) => {
      const newOptimisticComments = new Map(state.optimisticComments)
      newOptimisticComments.delete(tempId)

      const newSubmittingStatus = new Map(state.submittingStatus)
      newSubmittingStatus.delete(tempId)

      return {
        ...state,
        optimisticComments: newOptimisticComments,
        submittingStatus: newSubmittingStatus,
      }
    }),

  setSubmittingStatus: (tempId, status) =>
    set((state: CommentUISlice) => ({
      ...state,
      submittingStatus: new Map(state.submittingStatus).set(tempId, status),
    })),
})

export const useCommentStore = create<CommentUISlice>()(
  devtools((set) => createCommentUISlice(set), { name: 'CommentStore' })
)
