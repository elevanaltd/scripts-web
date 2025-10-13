import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCommentStore, type OptimisticComment } from './commentStore'

describe('useCommentStore', () => {
  const createMockOptimisticComment = (tempId: string): OptimisticComment => ({
    tempId,
    scriptId: 'script-123',
    content: 'Test comment content',
    startPosition: 0,
    endPosition: 10,
    highlightedText: 'Test text',
    userId: 'user-456',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  beforeEach(() => {
    // Reset store to initial state before each test
    const { setReplyingTo, setEditingComment } = useCommentStore.getState()

    act(() => {
      setReplyingTo(null)
      setEditingComment(null)
      // Reset maps
      useCommentStore.setState({
        optimisticComments: new Map(),
        submittingStatus: new Map(),
      })
    })
  })

  describe('Comment UI State', () => {
    it('initializes with null values and empty maps', () => {
      const { result } = renderHook(() => useCommentStore())

      expect(result.current.replyingTo).toBeNull()
      expect(result.current.editingComment).toBeNull()
      expect(result.current.optimisticComments.size).toBe(0)
      expect(result.current.submittingStatus.size).toBe(0)
    })

    it('updates replyingTo comment ID', () => {
      const { result } = renderHook(() => useCommentStore())

      act(() => {
        result.current.setReplyingTo('parent-comment-456')
      })

      expect(result.current.replyingTo).toBe('parent-comment-456')
    })

    it('updates editingComment ID', () => {
      const { result } = renderHook(() => useCommentStore())

      act(() => {
        result.current.setEditingComment('edit-comment-789')
      })

      expect(result.current.editingComment).toBe('edit-comment-789')
    })

    it('sets submitting status for specific comment', () => {
      const { result } = renderHook(() => useCommentStore())

      act(() => {
        result.current.setSubmittingStatus('temp-123', true)
      })

      expect(result.current.submittingStatus.get('temp-123')).toBe(true)

      act(() => {
        result.current.setSubmittingStatus('temp-123', false)
      })

      expect(result.current.submittingStatus.get('temp-123')).toBe(false)
    })
  })

  describe('Optimistic Comment Tracking with Full Payload', () => {
    it('tracks optimistic comment with full payload', () => {
      const { result } = renderHook(() => useCommentStore())
      const payload = createMockOptimisticComment('temp-123')

      act(() => {
        result.current.trackOptimisticComment('temp-123', payload)
      })

      expect(result.current.optimisticComments.size).toBe(1)
      const stored = result.current.optimisticComments.get('temp-123')
      expect(stored).toEqual(payload)
      expect(stored?.scriptId).toBe('script-123')
      expect(stored?.content).toBe('Test comment content')
      expect(stored?.startPosition).toBe(0)
      expect(stored?.endPosition).toBe(10)
    })

    it('resolves optimistic comment with real ID', () => {
      const { result } = renderHook(() => useCommentStore())
      const payload = createMockOptimisticComment('temp-123')

      act(() => {
        result.current.trackOptimisticComment('temp-123', payload)
      })

      act(() => {
        result.current.resolveOptimisticComment('temp-123', 'real-456')
      })

      const resolved = result.current.optimisticComments.get('temp-123')
      expect(resolved?.realId).toBe('real-456')
      expect(resolved?.tempId).toBe('temp-123')
      expect(resolved?.content).toBe('Test comment content') // Full payload preserved
    })

    it('removes optimistic comment and its submitting status', () => {
      const { result } = renderHook(() => useCommentStore())
      const payload1 = createMockOptimisticComment('temp-123')
      const payload2 = createMockOptimisticComment('temp-456')

      act(() => {
        result.current.trackOptimisticComment('temp-123', payload1)
        result.current.trackOptimisticComment('temp-456', payload2)
        result.current.setSubmittingStatus('temp-123', true)
        result.current.setSubmittingStatus('temp-456', true)
      })

      expect(result.current.optimisticComments.size).toBe(2)
      expect(result.current.submittingStatus.size).toBe(2)

      act(() => {
        result.current.removeOptimisticComment('temp-123')
      })

      expect(result.current.optimisticComments.size).toBe(1)
      expect(result.current.submittingStatus.size).toBe(1)
      expect(result.current.optimisticComments.has('temp-123')).toBe(false)
      expect(result.current.optimisticComments.has('temp-456')).toBe(true)
      expect(result.current.submittingStatus.has('temp-123')).toBe(false)
      expect(result.current.submittingStatus.has('temp-456')).toBe(true)
    })

    it('handles multiple optimistic comments with independent payloads', () => {
      const { result } = renderHook(() => useCommentStore())
      const payload1 = createMockOptimisticComment('temp-1')
      const payload2 = { ...createMockOptimisticComment('temp-2'), content: 'Second comment' }
      const payload3 = { ...createMockOptimisticComment('temp-3'), content: 'Third comment' }

      act(() => {
        result.current.trackOptimisticComment('temp-1', payload1)
        result.current.trackOptimisticComment('temp-2', payload2)
        result.current.trackOptimisticComment('temp-3', payload3)
      })

      expect(result.current.optimisticComments.size).toBe(3)

      act(() => {
        result.current.resolveOptimisticComment('temp-2', 'real-2')
      })

      expect(result.current.optimisticComments.get('temp-1')?.content).toBe('Test comment content')
      expect(result.current.optimisticComments.get('temp-2')?.content).toBe('Second comment')
      expect(result.current.optimisticComments.get('temp-2')?.realId).toBe('real-2')
      expect(result.current.optimisticComments.get('temp-3')?.content).toBe('Third comment')
    })

    it('handles missing comment during resolve gracefully', () => {
      const { result } = renderHook(() => useCommentStore())

      act(() => {
        result.current.resolveOptimisticComment('nonexistent', 'real-999')
      })

      // Should not throw, state should remain unchanged
      expect(result.current.optimisticComments.size).toBe(0)
    })
  })

  describe('Combined State Management', () => {
    it('maintains independent state for all properties', () => {
      const { result } = renderHook(() => useCommentStore())
      const payload = createMockOptimisticComment('temp-456')

      act(() => {
        result.current.setSubmittingStatus('temp-456', true)
        result.current.setReplyingTo('parent-123')
        result.current.trackOptimisticComment('temp-456', payload)
      })

      expect(result.current.submittingStatus.get('temp-456')).toBe(true)
      expect(result.current.replyingTo).toBe('parent-123')
      expect(result.current.optimisticComments.size).toBe(1)

      act(() => {
        result.current.setSubmittingStatus('temp-456', false)
      })

      expect(result.current.submittingStatus.get('temp-456')).toBe(false)
      expect(result.current.replyingTo).toBe('parent-123') // Should not change
      expect(result.current.optimisticComments.size).toBe(1) // Should not change
    })

    it('tracks multiple comments with individual submitting statuses', () => {
      const { result } = renderHook(() => useCommentStore())
      const payload1 = createMockOptimisticComment('temp-1')
      const payload2 = createMockOptimisticComment('temp-2')

      act(() => {
        result.current.trackOptimisticComment('temp-1', payload1)
        result.current.setSubmittingStatus('temp-1', true)
        result.current.trackOptimisticComment('temp-2', payload2)
        result.current.setSubmittingStatus('temp-2', false)
      })

      expect(result.current.optimisticComments.size).toBe(2)
      expect(result.current.submittingStatus.get('temp-1')).toBe(true)
      expect(result.current.submittingStatus.get('temp-2')).toBe(false)
    })
  })
})
