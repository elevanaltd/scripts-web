import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useScriptStore } from './scriptStore'

describe('useScriptStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const {
      setSaveStatus,
      setLastSaved,
      setComponentCount,
    } = useScriptStore.getState()
    act(() => {
      setSaveStatus('saved')
      setLastSaved(null)
      setComponentCount(0)
      // Reset workflow status state manually
      useScriptStore.setState({
        workflowStatus: null,
        workflowStatusRollback: null,
      })
    })
  })

  describe('ScriptSlice', () => {
    it('initializes with saved status and null lastSaved', () => {
      const { result } = renderHook(() => useScriptStore())

      expect(result.current.saveStatus).toBe('saved')
      expect(result.current.lastSaved).toBeNull()
    })

    it('updates saveStatus correctly', () => {
      const { result } = renderHook(() => useScriptStore())

      act(() => {
        result.current.setSaveStatus('saving')
      })

      expect(result.current.saveStatus).toBe('saving')
    })

    it('updates lastSaved timestamp', () => {
      const { result } = renderHook(() => useScriptStore())
      const testDate = new Date('2025-10-07T12:00:00Z')

      act(() => {
        result.current.setLastSaved(testDate)
      })

      expect(result.current.lastSaved).toEqual(testDate)
    })

    it('handles all saveStatus states', () => {
      const { result } = renderHook(() => useScriptStore())

      const statuses: Array<'saved' | 'saving' | 'unsaved' | 'error'> = [
        'saved',
        'saving',
        'unsaved',
        'error',
      ]

      statuses.forEach((status) => {
        act(() => {
          result.current.setSaveStatus(status)
        })
        expect(result.current.saveStatus).toBe(status)
      })
    })
  })

  describe('EditorSlice', () => {
    it('initializes with zero component count', () => {
      const { result } = renderHook(() => useScriptStore())

      expect(result.current.componentCount).toBe(0)
    })

    it('updates component count correctly', () => {
      const { result } = renderHook(() => useScriptStore())

      act(() => {
        result.current.setComponentCount(5)
      })

      expect(result.current.componentCount).toBe(5)
    })

    it('handles component count updates from different values', () => {
      const { result } = renderHook(() => useScriptStore())

      act(() => {
        result.current.setComponentCount(3)
      })
      expect(result.current.componentCount).toBe(3)

      act(() => {
        result.current.setComponentCount(7)
      })
      expect(result.current.componentCount).toBe(7)

      act(() => {
        result.current.setComponentCount(0)
      })
      expect(result.current.componentCount).toBe(0)
    })
  })

  describe('WorkflowStatusSlice', () => {
    it('initializes with null workflow status', () => {
      const { result } = renderHook(() => useScriptStore())

      expect(result.current.workflowStatus).toBeNull()
      expect(result.current.workflowStatusRollback).toBeNull()
    })

    it('updates workflow status correctly', () => {
      const { result } = renderHook(() => useScriptStore())

      act(() => {
        result.current.setWorkflowStatus('in_review')
      })

      expect(result.current.workflowStatus).toBe('in_review')
    })

    it('prepares rollback context correctly', () => {
      const { result } = renderHook(() => useScriptStore())

      act(() => {
        result.current.prepareStatusRollback('draft')
      })

      expect(result.current.workflowStatusRollback).toBe('draft')
    })

    it('performs rollback correctly', () => {
      const { result } = renderHook(() => useScriptStore())

      // Set initial status and prepare rollback
      act(() => {
        result.current.setWorkflowStatus('draft')
        result.current.prepareStatusRollback('draft')
      })

      // Change status optimistically
      act(() => {
        result.current.setWorkflowStatus('in_review')
      })

      expect(result.current.workflowStatus).toBe('in_review')

      // Rollback to previous status
      act(() => {
        result.current.rollbackStatus()
      })

      expect(result.current.workflowStatus).toBe('draft')
      expect(result.current.workflowStatusRollback).toBeNull()
    })

    it('handles all workflow status values', () => {
      const { result } = renderHook(() => useScriptStore())

      const statuses = ['draft', 'in_review', 'rework', 'approved'] as const

      statuses.forEach((status) => {
        act(() => {
          result.current.setWorkflowStatus(status)
        })
        expect(result.current.workflowStatus).toBe(status)
      })
    })
  })

  describe('Combined State', () => {
    it('maintains independent state for both slices', () => {
      const { result } = renderHook(() => useScriptStore())

      act(() => {
        result.current.setSaveStatus('saving')
        result.current.setComponentCount(3)
      })

      expect(result.current.saveStatus).toBe('saving')
      expect(result.current.componentCount).toBe(3)

      act(() => {
        result.current.setSaveStatus('saved')
      })

      expect(result.current.saveStatus).toBe('saved')
      expect(result.current.componentCount).toBe(3) // Should not change
    })

    it('maintains independent workflow status state', () => {
      const { result } = renderHook(() => useScriptStore())

      act(() => {
        result.current.setSaveStatus('saving')
        result.current.setWorkflowStatus('in_review')
        result.current.setComponentCount(5)
      })

      expect(result.current.saveStatus).toBe('saving')
      expect(result.current.workflowStatus).toBe('in_review')
      expect(result.current.componentCount).toBe(5)

      // Change workflow status - should not affect others
      act(() => {
        result.current.setWorkflowStatus('approved')
      })

      expect(result.current.saveStatus).toBe('saving')
      expect(result.current.workflowStatus).toBe('approved')
      expect(result.current.componentCount).toBe(5)
    })
  })
})
