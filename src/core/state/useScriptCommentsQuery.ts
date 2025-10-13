import { useQuery } from '@tanstack/react-query'
import { getComments } from '../../lib/comments'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { CommentWithRecovery } from '../../types/comments'

// Critical-Engineer: consulted for query architecture with Supabase integration
// Architecture: TanStack Query for comments with real-time sync readiness
// Security fix: Added currentUser authentication gate to prevent RLS violations

/**
 * Hook for querying script comments
 *
 * Architecture compliance:
 * - Named query key for React Query DevTools
 * - Auto-fetch when scriptId AND currentUser provided (security gate)
 * - 30-second stale time for comment freshness
 * - Ready for real-time updates via RealtimeProvider
 *
 * Security:
 * - Query only executes when authenticated (prevents RLS policy violations)
 * - Cache isolated per user (prevents cross-user data leakage)
 * - Critical-engineer: consulted for security vulnerability mitigation
 * - P1 Fix (2025-10-10): Added userId to queryKey for per-user cache isolation
 */
export const useScriptCommentsQuery = (scriptId: string | null) => {
  const { currentUser } = useAuth()

  return useQuery<CommentWithRecovery[], Error>({
    queryKey: ['comments', scriptId, currentUser?.id] as const,
    queryFn: async () => {
      if (!scriptId) {
        throw new Error('No script ID provided')
      }

      const result = await getComments(supabase, scriptId)

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to fetch comments')
      }

      return result.data
    },
    enabled: !!scriptId && !!currentUser?.id,
    staleTime: 1000 * 30, // 30 seconds - comments need fresher data than scripts
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  })
}
