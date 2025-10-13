import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saveScript, updateScriptStatus, saveScriptWithComponents } from '../../services/scriptService'
import { useScriptStore } from '../stores/scriptStore'
import type { Script, ScriptWorkflowStatus, ComponentData } from '../../services/scriptService'

// Critical-Engineer: consulted for mutation architecture with Amendment #1 state coordination
// Amendment #3: PATCH pattern for concurrency safety (prevents data corruption)
// Architecture: Lines 434-437 - TanStack Query mutations with cache invalidation
// Amendment #1: Explicit Zustand state coordination for save status
// Gap #1 & #4 Resolution: Added updateStatus mutation with correct cache key (Phase 2.95B)
// GAP-002 Resolution: Extended SaveScriptParams to support component persistence (Phase 2.95C)
// Testguard consulted: Tests exist at useScriptMutations.test.tsx (co-located, lines 351-497)

interface SaveScriptParams {
  scriptId: string
  updates: Partial<Omit<Script, 'id' | 'video_id' | 'created_at' | 'updated_at' | 'components'>> & {
    components?: ComponentData[] // GAP-002: Optional component array for atomic RPC saves
  }
}

interface UpdateStatusParams {
  scriptId: string
  status: ScriptWorkflowStatus
  videoId: string // Required for correct cache key (Gap #4)
}

/**
 * Hook for script mutations (save, update)
 * Implements Amendment #1: Explicit state coordination between React Query and Zustand
 * Implements Amendment #3: PATCH pattern for concurrency safety
 * Implements GAP-002: Component persistence via atomic RPC when components provided
 *
 * Architecture compliance:
 * - Named mutation key for React Query DevTools (Line 434-435)
 * - Cache invalidation on success (Line 436-437)
 * - Zustand state updates for save status (Amendment #1)
 * - PATCH pattern prevents concurrent save data corruption (Amendment #3)
 * - Atomic RPC for component persistence (GAP-002)
 */
export const useScriptMutations = () => {
  const queryClient = useQueryClient()
  const { setSaveStatus, setLastSaved, setError } = useScriptStore()

  const saveMutation = useMutation({
    mutationKey: ['saveScript'], // Architecture Line 434-435
    mutationFn: async (params: SaveScriptParams) => {
      // GAP-002: Route to atomic RPC if components provided, otherwise use PATCH
      if (params.updates.components && params.updates.components.length > 0) {
        // Use atomic RPC function for component persistence
        const { yjs_state, plain_text, components } = params.updates
        return saveScriptWithComponents(
          params.scriptId,
          yjs_state || null,
          plain_text || '',
          components
        )
      }

      // Amendment #3: PATCH pattern - only send fields that changed
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { components: _, ...patchUpdates } = params.updates
      return saveScript(params.scriptId, patchUpdates)
    },
    onMutate: () => {
      // Amendment #1: Set saving state explicitly
      setSaveStatus('saving')
      setError(null)
    },
    onSuccess: () => {
      // Amendment #1: Set saved state explicitly
      setSaveStatus('saved')
      setLastSaved(new Date())

      // Architecture Line 436-437: Invalidate cache
      queryClient.invalidateQueries({
        queryKey: ['script']
      })
    },
    onError: (error: Error) => {
      // Amendment #1: Set error state explicitly
      setSaveStatus('error')
      setError(error.message)
    },
  })

  // Testguard consulted: Tests exist at useScriptMutations.test.tsx lines 351-497
  // Gap #1 Resolution: updateStatus mutation with rollback (Phase 2.95B)
  // Critical-Engineer consulted: scriptService.updateScriptStatus throws on error, returns Script directly
  const updateStatus = useMutation({
    mutationKey: ['updateScriptStatus'],
    mutationFn: async ({ scriptId, status }: UpdateStatusParams) => {
      // Service throws on error, returns Script directly (not { success, data, error } wrapper)
      return await updateScriptStatus(scriptId, status)
    },
    onMutate: async ({ scriptId: _scriptId, status, videoId }) => {
      const { workflowStatus, prepareStatusRollback, setWorkflowStatus } = useScriptStore.getState()

      // Cancel outgoing refetches (Gap #4: use videoId for cache key)
      await queryClient.cancelQueries({ queryKey: ['script', videoId] })

      // Snapshot previous value for rollback
      const previousScript = queryClient.getQueryData<Script>(['script', videoId])

      // Prepare Zustand rollback context (Gap #3)
      if (workflowStatus) {
        prepareStatusRollback(workflowStatus)
      }

      // Optimistic update to store
      setWorkflowStatus(status)

      // Optimistic update to query cache (Gap #4: correct cache key)
      if (previousScript && videoId) {
        queryClient.setQueryData(['script', videoId], {
          ...previousScript,
          status,
        })
      }

      return { previousScript, rollbackStatus: workflowStatus }
    },
    onSuccess: (data, variables) => {
      // Replace optimistic update with server response (Gap #4)
      if (variables.videoId) {
        queryClient.setQueryData(['script', variables.videoId], data)
      }
    },
    onError: (error, variables, context) => {
      // Rollback Zustand store (Gap #3)
      useScriptStore.getState().rollbackStatus()

      // Rollback query cache (Gap #4)
      if (context?.previousScript && variables.videoId) {
        queryClient.setQueryData(['script', variables.videoId], context.previousScript)
      }

      console.error('Status update failed:', error)
    },
  })

  return {
    saveMutation,
    updateStatus,
  }
}
