import { useState, useEffect, useCallback, useRef } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'
import { acquireScriptLock, scriptLocksTable } from '../lib/supabaseHelpers'

// Generic Database type to accept both local and shared-lib Database types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any

// Export interface for type safety
export interface ScriptLockStatus {
  lockStatus: 'acquired' | 'locked' | 'checking' | 'unlocked'
  lockedBy: { id: string; name: string } | null
  releaseLock: () => Promise<void>
  requestEdit: () => Promise<void>
  forceUnlock: () => Promise<void> // Admin only
}

// Heartbeat interval: 5 minutes
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000

/**
 * Hook for managing script edit locks
 *
 * @param scriptId - UUID of script to lock
 * @param client - Supabase client (defaults to production, tests can override with testSupabase)
 *
 * **Dependency Injection Pattern:**
 * - Production: Uses default supabase client (no changes required)
 * - Tests: Pass testSupabase client configured for localhost
 * - Architectural coherence: Client is injected, not environment-detected
 */
export function useScriptLock(
  scriptId: string | undefined,
  client: SupabaseClient<AnyDatabase> = supabase
): ScriptLockStatus {
  const [lockStatus, setLockStatus] = useState<'acquired' | 'locked' | 'checking' | 'unlocked'>(
    'checking'
  )
  const [lockedBy, setLockedBy] = useState<{ id: string; name: string } | null>(null)

  // Track acquisition state to prevent race conditions
  const isAcquiringRef = useRef(false)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Auto-lock on mount
  const acquireLock = useCallback(async () => {
    if (!scriptId || isAcquiringRef.current) return

    isAcquiringRef.current = true
    setLockStatus('checking')

    try {
      const { data, error } = await acquireScriptLock(client, scriptId)

      if (error) {
        console.error('Lock acquisition error:', error)
        setLockStatus('locked')
        isAcquiringRef.current = false
        return
      }

      const lockResult = data?.[0]
      if (lockResult?.success) {
        setLockStatus('acquired')
        setLockedBy({ id: lockResult.locked_by_user_id, name: lockResult.locked_by_name })
      } else if (lockResult) {
        setLockStatus('locked')
        setLockedBy({ id: lockResult.locked_by_user_id || '', name: lockResult.locked_by_name || 'Unknown' })
      }
    } catch (err) {
      console.error('Lock acquisition failed:', err)
      setLockStatus('locked')
    } finally {
      isAcquiringRef.current = false
    }
  }, [scriptId, client])

  // Heartbeat: Keep-alive every 5 minutes
  const sendHeartbeat = useCallback(async () => {
    if (!scriptId || lockStatus !== 'acquired') return

    try {
      const { error} = await scriptLocksTable(client)
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('script_id', scriptId)

      if (error) {
        console.error('Heartbeat failed:', error)
        setLockStatus('checking')
        // Attempt re-acquisition after heartbeat failure
        await acquireLock()
      }
    } catch (err) {
      console.error('Heartbeat error:', err)
      setLockStatus('checking')
      await acquireLock()
    }
  }, [scriptId, lockStatus, acquireLock, client])

  // Lock release (manual unlock)
  const releaseLock = useCallback(async () => {
    if (!scriptId) return

    try {
      await scriptLocksTable(client).delete().eq('script_id', scriptId)
      setLockStatus('unlocked')
      setLockedBy(null)
    } catch (err) {
      console.error('Lock release failed:', err)
    }
  }, [scriptId, client])

  // Request edit access (sends notification to lock holder)
  const requestEdit = useCallback(async () => {
    if (!scriptId || !lockedBy) return

    // TODO: Implement notification system (Phase 3/4 enhancement)
    console.log(`Requesting edit access from ${lockedBy.name}`)
  }, [scriptId, lockedBy])

  // Force unlock (admin only)
  const forceUnlock = useCallback(async () => {
    if (!scriptId) return

    try {
      await scriptLocksTable(client).delete().eq('script_id', scriptId)
      setLockStatus('unlocked')
      setLockedBy(null)
    } catch (err) {
      console.error('Force unlock failed:', err)
    }
  }, [scriptId, client])

  // Initialize: Acquire lock on mount
  useEffect(() => {
    if (!scriptId) return

    acquireLock()

    // Cleanup on unmount
    return () => {
      if (scriptId && lockStatus === 'acquired') {
        scriptLocksTable(client).delete().eq('script_id', scriptId)
      }

      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }

      // Unsubscribe from realtime channel
      if (channelRef.current) {
        client.removeChannel(channelRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]) // Only depend on scriptId to prevent re-acquisition loops (acquireLock and client intentionally excluded)

  // Heartbeat interval: Start after lock acquired
  useEffect(() => {
    if (lockStatus !== 'acquired' || !scriptId) {
      // Clear heartbeat if lock lost
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      return
    }

    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [lockStatus, scriptId, sendHeartbeat])

  // Realtime subscriptions: Listen for lock changes
  useEffect(() => {
    if (!scriptId) return

    const channel = client
      .channel(`script_locks:${scriptId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'script_locks',
          filter: `script_id=eq.${scriptId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newLock = payload.new as any
            setLockStatus('locked')
            setLockedBy({ id: newLock.locked_by_id, name: newLock.locked_by_name })
          } else if (payload.eventType === 'DELETE') {
            // Lock released - attempt re-acquisition
            acquireLock()
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      client.removeChannel(channel)
    }
  }, [scriptId, acquireLock, client])

  return {
    lockStatus,
    lockedBy,
    releaseLock,
    requestEdit,
    forceUnlock,
  }
}
