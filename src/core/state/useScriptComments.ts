import { useCallback, useEffect, useState, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { useScriptCommentsQuery } from './useScriptCommentsQuery'
import { useCommentMutations } from './useCommentMutations'
import { useCommentStore } from '../stores/commentStore'
import { useCurrentScript } from './useCurrentScript'
import { getUserFriendlyErrorMessage } from '../../utils/errorHandling'
import { Logger } from '../../services/logger'

// Constitutional Authority: holistic-orchestrator - Phase 1 unified interface hooks
// Implementation-lead consulted: Gap G6 synthesis - preserve error context via callback patterns
// Gap G6 Re-evaluation: "Superior error handling" = context-specific messages (preserved via helper)
// Architecture: Unified interface that wraps useScriptCommentsQuery + useCommentMutations + useCommentStore
// Step 2.1.4: Extended to manage ALL comment-related UI state and editor event listeners

export interface CommentErrorContext {
  operation: 'create' | 'reply' | 'resolve' | 'unresolve' | 'delete'
  resource: 'comment' | 'reply'
}

export interface CommentHighlight {
  commentId: string
  commentNumber: number
  startPosition: number
  endPosition: number
  resolved?: boolean
}

export interface CommentSelectionState {
  text: string
  from: number
  to: number
}

export interface CommentPopupPosition {
  top: number
  left: number
}

/**
 * Unified comment interface that preserves Gap G6 error handling quality
 *
 * Provides single hook for all comment-related state and operations:
 * - Comment fetching with threading (via TanStack Query)
 * - CRUD mutations with optimistic UI
 * - Realtime subscription status
 * - Context-aware error handling (Gap G6 preservation)
 * - Comment highlight loading and rendering (Step 2.1.4)
 * - Text selection handling for comment creation (Step 2.1.4)
 * - Editor event listener management (Step 2.1.4)
 *
 * Benefits:
 * - Reduces TipTapEditor.tsx by ~138 LOC (comment system extraction)
 * - Centralizes comment lifecycle management
 * - Preserves Gap G6 context-specific error messages via helper
 * - Components retain low-level access via mutations property
 * - All editor-coupled logic managed through editor parameter
 *
 * Constitutional Compliance:
 * - Gap G6 (Lines 188-195): Context-specific error messages preserved via createContextualError
 * - MIP (Line 32): Essential complexity (reduces boilerplate), not accumulative (preserves low-level access)
 * - Line 169-176: Constitutional essential = error context (preserved)
 * - Step 2.1.4: Extract ALL business logic to hooks, component = orchestration only
 */
export const useScriptComments = (editor: Editor | null) => {
  const { currentScript } = useCurrentScript()
  const commentsQuery = useScriptCommentsQuery(currentScript?.id || null)
  const mutations = useCommentMutations()
  const store = useCommentStore()

  // Comment UI state (extracted from TipTapEditor.tsx L219-241)
  const [commentHighlights, setCommentHighlights] = useState<CommentHighlight[]>([])
  const [selectedText, setSelectedText] = useState<CommentSelectionState | null>(null)
  const [showCommentPopup, setShowCommentPopup] = useState(false)
  const [popupPosition, setPopupPosition] = useState<CommentPopupPosition | null>(null)
  const [createCommentData, setCreateCommentData] = useState<{
    startPosition: number
    endPosition: number
    selectedText: string
  } | null>(null)

  // Track component mount state for cleanup
  const isMountedRef = useRef(true)

  /**
   * Load comment highlights from database
   * Extracted from TipTapEditor.tsx L453-504 (~51 LOC)
   */
  const loadCommentHighlights = useCallback(async (scriptId: string) => {
    if (!editor) return

    // Don't load comments for readonly placeholder scripts
    if (scriptId.startsWith('readonly-')) {
      return
    }

    try {
      // Import the comments module and load highlights
      const { getComments } = await import('../../lib/comments')
      const { supabase } = await import('../../lib/supabase')

      // Load comments WITHOUT documentContent - positions are already correct PM positions
      const result = await getComments(supabase, scriptId)

      if (result.success && result.data) {
        const highlights = result.data
          .filter(comment => !comment.parentCommentId) // Only parent comments have highlights
          .map((comment, index) => ({
            commentId: comment.id,
            commentNumber: index + 1,
            startPosition: comment.startPosition,
            endPosition: comment.endPosition,
            resolved: !!comment.resolvedAt,
          }))

        setCommentHighlights(highlights)

        // Load highlights into editor
        if (highlights.length > 0) {
          editor.commands.loadExistingHighlights(highlights)
        }

        // Log position recovery results if any comments were recovered
        const recoveredComments = result.data.filter(c => c.recovery && c.recovery.status === 'relocated')
        if (recoveredComments.length > 0) {
          Logger.info(`Position recovery: ${recoveredComments.length} comment(s) relocated`, {
            recovered: recoveredComments.map(c => ({
              id: c.id,
              status: c.recovery?.status,
              matchQuality: c.recovery?.matchQuality,
              message: c.recovery?.message
            }))
          })
        }
      }
    } catch (error) {
      Logger.error('Failed to load comment highlights', { error: (error as Error).message })
    }
  }, [editor])

  /**
   * Text selection handler for comments
   * Extracted from TipTapEditor.tsx L506-571 (~65 LOC)
   */
  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      if (!isMountedRef.current) return

      const { from, to, empty } = editor.state.selection

      if (empty) {
        // No text selected, hide popup
        setSelectedText(null)
        setShowCommentPopup(false)
        setPopupPosition(null)
      } else {
        // Text is selected
        const selectedContent = editor.state.doc.textBetween(from, to)
        if (selectedContent.trim()) {
          // Calculate popup position based on selection coordinates
          try {
            const coords = editor.view.coordsAtPos(from)
            const editorRect = editor.view.dom.getBoundingClientRect()

            // Position popup above selection, or below if not enough space above
            const popupHeight = 80 // Estimated popup height
            const spaceAbove = coords.top - editorRect.top
            const spaceBelow = editorRect.bottom - coords.bottom

            let top = coords.top - popupHeight - 10 // 10px gap above selection
            if (spaceAbove < popupHeight + 20 && spaceBelow > popupHeight + 20) {
              // Not enough space above, position below
              top = coords.bottom + 10
            }

            const left = Math.max(20, Math.min(coords.left - 100, window.innerWidth - 220)) // Center popup, but keep on screen

            // Enhancement #1: Directly show comment form in sidebar (bypass popup)
            setCreateCommentData({
              startPosition: from,
              endPosition: to,
              selectedText: selectedContent,
            })

            // Keep legacy state for backward compatibility
            setSelectedText({
              text: selectedContent,
              from,
              to
            })
            setPopupPosition({ top, left })
            setShowCommentPopup(false) // Enhancement #1: No popup needed
          } catch (error) {
            // Fallback to center positioning if coordinate calculation fails
            Logger.warn('Failed to calculate popup position, using fallback', { error: (error as Error).message })

            // Enhancement #1: Directly show comment form in sidebar (bypass popup)
            setCreateCommentData({
              startPosition: from,
              endPosition: to,
              selectedText: selectedContent,
            })

            // Keep legacy state for backward compatibility
            setSelectedText({
              text: selectedContent,
              from,
              to
            })
            setPopupPosition(null) // Will use CSS fallback positioning
            setShowCommentPopup(false) // Enhancement #1: No popup needed
          }
        }
      }
    }

    // Listen for selection updates using TipTap's event system
    editor.on('selectionUpdate', handleSelectionUpdate)

    return () => {
      // Clean up the subscription
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor])

  /**
   * Blur handler for comment position recovery
   * Extracted from TipTapEditor.tsx L573-599 (~26 LOC)
   */
  useEffect(() => {
    if (!editor || !currentScript) return

    let blurTimeoutId: NodeJS.Timeout | null = null

    const handleBlur = () => {
      // Debounce: Wait 500ms after blur to update positions
      if (blurTimeoutId) {
        clearTimeout(blurTimeoutId)
      }

      blurTimeoutId = setTimeout(() => {
        if (!isMountedRef.current || !currentScript) return

        Logger.info('Editor blur: Recovering comment positions', {
          scriptId: currentScript.id,
          trigger: 'blur'
        })

        // Reload comment highlights with position recovery
        loadCommentHighlights(currentScript.id)
      }, 500) // 500ms debounce
    }

    editor.on('blur', handleBlur)

    return () => {
      editor.off('blur', handleBlur)
      if (blurTimeoutId) {
        clearTimeout(blurTimeoutId)
      }
    }
  }, [editor, currentScript, loadCommentHighlights])

  /**
   * Mount/unmount tracking
   */
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Create context-aware error message (Gap G6 preservation)
   *
   * Wraps getUserFriendlyErrorMessage with comment-specific context
   * Enables components to provide operation-specific error messages:
   * - "Failed to create comment. Please try again."
   * - "Failed to delete comment. Please try again."
   * - "Failed to resolve comment. Please try again."
   *
   * @param error - Error from mutation
   * @param context - Operation and resource context
   * @returns User-friendly error message
   */
  const createContextualError = (error: Error, context: CommentErrorContext): string => {
    return getUserFriendlyErrorMessage(error, context)
  }

  return {
    // Query state - threaded comments
    threads: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
    error: commentsQuery.error,
    refetch: commentsQuery.refetch,

    // Mutations - direct access for onError callbacks (Gap G6 preservation)
    mutations,

    // Convenience wrappers - simplified async API
    createComment: mutations.createMutation.mutateAsync,
    updateComment: mutations.updateMutation.mutateAsync,
    deleteComment: mutations.deleteMutation.mutateAsync,
    resolveComment: mutations.resolveMutation.mutateAsync,
    unresolveComment: mutations.unresolveMutation.mutateAsync,

    // Mutation status
    isCreating: mutations.createMutation.isPending,
    isDeleting: mutations.deleteMutation.isPending,
    isResolving: mutations.resolveMutation.isPending,

    // Store access - optimistic state
    optimisticComments: store.optimisticComments,
    submittingStatus: store.submittingStatus,

    // Error helper - Gap G6 context preservation
    createContextualError,

    // Additional context
    scriptId: currentScript?.id || null,

    // Comment UI state (Step 2.1.4 extraction)
    commentHighlights,
    setCommentHighlights,
    selectedText,
    setSelectedText,
    showCommentPopup,
    setShowCommentPopup,
    popupPosition,
    setPopupPosition,
    createCommentData,
    setCreateCommentData,

    // Comment highlight loading (Step 2.1.4 extraction)
    loadCommentHighlights,
  }
}
