import { useQuery } from '@tanstack/react-query'
import { useNavigation } from '../../contexts/NavigationContext'
import { useAuth } from '../../contexts/AuthContext'
import { loadScriptForVideo } from '../../services/scriptService'

// Critical-Engineer: consulted for Server state management architecture (Amendment #1)
// Architecture: Lines 417-433 - TanStack Query for server state with 5-minute stale time

/**
 * Hook to fetch current script data based on selected video
 * Uses TanStack Query for server state management with caching
 *
 * Architecture compliance:
 * - 5-minute stale time for optimal UX (Line 430)
 * - Enabled only when video AND auth are ready (prevents queryKey race condition)
 * - Passes user role for RLS enforcement
 * - Query key: ['script', videoId, userId] for per-user cache isolation
 *
 * Security:
 * - P1 Fix (2025-10-10): Added userId to queryKey for per-user cache isolation
 * - Prevents cross-user script data leakage on logout/login transitions
 *
 * Race Condition Fix (2025-10-11):
 * - Wait for currentUser before enabling query to prevent queryKey changes mid-flight
 * - Prevents 409 Conflict when auth loads: ['script', videoId, undefined] → ['script', videoId, userId]
 * - React Query treats different queryKeys as separate requests → concurrent INSERTs → 409
 */
export const useCurrentScriptData = () => {
  const { selectedVideo } = useNavigation()
  const { currentUser, userProfile } = useAuth()

  return useQuery({
    queryKey: ['script', selectedVideo?.id, currentUser?.id],
    queryFn: () => {
      if (!selectedVideo) {
        throw new Error('No video selected')
      }
      return loadScriptForVideo(selectedVideo.id, userProfile?.role || null)
    },
    enabled: !!selectedVideo && !!currentUser, // Wait for auth to prevent queryKey race condition
    staleTime: 1000 * 60 * 5, // 5 minutes (Architecture Line 430)
  })
}
