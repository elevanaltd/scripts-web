import { ReactNode, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Critical-Engineer: consulted for real-time architecture with Supabase subscriptions
// Architecture: Supabase Realtime for live updates to scripts and comments

interface RealtimeProviderProps {
  children: ReactNode
  scriptId?: string | null
}

/**
 * Provider for Supabase real-time subscriptions
 *
 * Architecture compliance:
 * - Subscribe to script and comment changes
 * - Auto-invalidate React Query cache on updates
 * - Clean up subscriptions on unmount
 * - Scoped to provided scriptId for efficiency
 *
 * Features:
 * - Script updates (plain_text, yjs_state changes)
 * - Comment CRUD operations (INSERT, UPDATE, DELETE)
 * - Automatic cache invalidation for seamless updates
 */
export const RealtimeProvider = ({ children, scriptId }: RealtimeProviderProps) => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!scriptId) {
      return
    }

    const channels: RealtimeChannel[] = []

    // Subscribe to script updates
    const scriptChannel = supabase
      .channel(`script:${scriptId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scripts',
          filter: `id=eq.${scriptId}`,
        },
        () => {
          // Invalidate script query on any update
          queryClient.invalidateQueries({
            queryKey: ['script', scriptId]
          })
        }
      )
      .subscribe()

    channels.push(scriptChannel)

    // Subscribe to comment changes for the current script
    const commentChannel = supabase
      .channel(`comments:${scriptId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'comments',
          filter: `script_id=eq.${scriptId}`,
        },
        () => {
          // Invalidate comments query on any change
          queryClient.invalidateQueries({
            queryKey: ['comments', scriptId]
          })
        }
      )
      .subscribe()

    channels.push(commentChannel)

    // Cleanup subscriptions on unmount or script change
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel)
      })
    }
  }, [scriptId, queryClient])

  return <>{children}</>
}
