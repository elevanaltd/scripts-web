import { useNavigation } from '../../contexts/NavigationContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentScriptData } from './useCurrentScriptData'
import { useScriptMutations } from './useScriptMutations'
import { useScriptStore } from '../stores/scriptStore'
import type { ScriptWorkflowStatus, ComponentData } from '../../services/scriptService'

// Constitutional Authority: holistic-orchestrator - Phase 1 unified interface hooks
// MIP Enforcement (Line 32-36): Essential complexity that enables 78% reduction in TipTapEditor
// Implementation-lead consulted: Validated 150 LOC savings in component simplification
// Architecture: Unified interface wrapping useCurrentScriptData + useScriptMutations + useScriptStore
// GAP-002 Resolution: Extended save() to accept ComponentData[] for persistence (Phase 2.95C)

/**
 * Unified interface for current script operations
 *
 * Provides single hook for all script-related state and operations:
 * - Script data fetching (via TanStack Query)
 * - Save operations with optimistic UI
 * - Status updates with rollback
 * - Save status indicators
 * - Component persistence (GAP-002)
 *
 * Benefits:
 * - Reduces TipTapEditor from ~150 LOC of hook orchestration to single hook call
 * - Centralizes script lifecycle management
 * - Maintains constitutional architecture (React Query + Zustand coordination)
 * - Enables component persistence via atomic RPC (GAP-002)
 *
 * Constitutional Compliance:
 * - Amendment #1: Explicit state coordination preserved
 * - Amendment #3: PATCH pattern for concurrency safety preserved
 * - Gap G1-G4: All resolution patterns maintained through underlying hooks
 * - GAP-002: Component persistence via ComponentData[] parameter
 */
export const useCurrentScript = () => {
  const { selectedVideo } = useNavigation()
  const { userProfile } = useAuth()
  const { data: currentScript, isLoading, error: queryError } = useCurrentScriptData()
  const { saveMutation, updateStatus: updateStatusMutation } = useScriptMutations()
  const { saveStatus, setSaveStatus, lastSaved, componentCount, error: storeError } = useScriptStore()

  /**
   * Save script content with component persistence
   * Wraps saveMutation with simplified interface
   *
   * GAP-002 Resolution: Now accepts ComponentData[] for atomic persistence
   * Routes to saveScriptWithComponents RPC when components provided
   *
   * @param yjsState - Y.js document state (Uint8Array | null, null until Phase 4)
   * @param plainText - Extracted plain text for search/display
   * @param components - Component array for atomic persistence (GAP-002)
   */
  const save = async (
    yjsState: Uint8Array | null,
    plainText: string,
    components: ComponentData[]
  ) => {
    if (!currentScript?.id) {
      throw new Error('No script loaded')
    }

    return saveMutation.mutateAsync({
      scriptId: currentScript.id,
      updates: {
        yjs_state: yjsState,
        plain_text: plainText,
        component_count: components.length, // Derived from components array
        components, // GAP-002: Component persistence
      },
    })
  }

  /**
   * Update script workflow status
   * Wraps updateStatus with simplified interface
   */
  const updateStatus = async (status: ScriptWorkflowStatus) => {
    if (!currentScript?.id || !selectedVideo?.id) {
      throw new Error('No script or video selected')
    }

    return updateStatusMutation.mutateAsync({
      scriptId: currentScript.id,
      status,
      videoId: selectedVideo.id,
    })
  }

  return {
    // Script data
    currentScript: currentScript || null,
    isLoading,

    // Save status (from Zustand store)
    saveStatus,
    setSaveStatus,
    lastSaved,
    componentCount,

    // Mutations
    save,
    updateStatus,
    isSaving: saveMutation.isPending,
    isUpdatingStatus: updateStatusMutation.isPending,

    // Error state (query error takes precedence over store error)
    error: queryError || storeError,

    // Additional context
    selectedVideo,
    userRole: userProfile?.role || null,
  }
}
