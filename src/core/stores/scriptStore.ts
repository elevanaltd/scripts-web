import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ScriptWorkflowStatus } from '../../services/scriptService'

// Critical-Engineer: consulted for State management (Amendment #1)
// Architecture: Lines 625-660 - Explicit state coordination for save status
// Gap #3 Resolution: Added workflow status slice with rollback context (Phase 2.95B)

type ScriptSlice = {
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error'
  lastSaved: Date | null
  error: string | null
  setSaveStatus: (status: ScriptSlice['saveStatus']) => void
  setLastSaved: (date: Date | null) => void
  setError: (error: string | null) => void

  // Workflow status management (Gap #3 resolution)
  workflowStatus: ScriptWorkflowStatus | null
  setWorkflowStatus: (status: ScriptWorkflowStatus) => void
  workflowStatusRollback: ScriptWorkflowStatus | null
  prepareStatusRollback: (current: ScriptWorkflowStatus) => void
  rollbackStatus: () => void
}

type EditorSlice = {
  componentCount: number
  setComponentCount: (count: number) => void
}

const createScriptSlice = (
  set: (
    partial:
      | Partial<ScriptSlice & EditorSlice>
      | ((state: ScriptSlice & EditorSlice) => Partial<ScriptSlice & EditorSlice>)
  ) => void
): ScriptSlice => ({
  saveStatus: 'saved' as const,
  lastSaved: null,
  error: null,
  setSaveStatus: (status) => set({ saveStatus: status }),
  setLastSaved: (date) => set({ lastSaved: date }),
  setError: (error) => set({ error }),

  // Workflow status management (Gap #3 resolution)
  workflowStatus: null,
  workflowStatusRollback: null,
  setWorkflowStatus: (status) => set({ workflowStatus: status }),
  prepareStatusRollback: (current) => set({ workflowStatusRollback: current }),
  rollbackStatus: () =>
    set((state: ScriptSlice & EditorSlice) => ({
      workflowStatus: state.workflowStatusRollback,
      workflowStatusRollback: null,
    })),
})

const createEditorSlice = (
  set: (partial: Partial<ScriptSlice & EditorSlice>) => void
): EditorSlice => ({
  componentCount: 0,
  setComponentCount: (count) => set({ componentCount: count }),
})

export const useScriptStore = create<ScriptSlice & EditorSlice>()(
  devtools(
    (set) => ({
      ...createScriptSlice(set),
      ...createEditorSlice(set),
    }),
    { name: 'ScriptStore' }
  )
)
