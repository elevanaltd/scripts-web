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
  const isUnmountingRef = useRef(false)
  const isManualReleaseRef = useRef(false)
  const lockAcquisitionSucceededRef = useRef(false) // Track if OUR lock acquisition RPC succeeded
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reacquisitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-lock on mount
  const acquireLock = useCallback(async () => {
    if (!scriptId || isAcquiringRef.current || isUnmountingRef.current) return

    isAcquiringRef.current = true
    setLockStatus('checking')

    try {
      const { data, error } = await acquireScriptLock(client, scriptId)

      if (error) {
        console.error('[useScriptLock] Lock acquisition error:', error)
        setLockStatus('locked')
        isAcquiringRef.current = false
        return
      }

      const lockResult = data?.[0]
      if (lockResult?.success) {
        // RACE CONDITION FIX (2025-10-31): Verify lock exists in database before setting acquired
        // Problem: acquireScriptLock() returns success immediately, but database INSERT may not be visible yet
        // The actual fix is in TipTapEditor handleSave() which verifies lock in database before saving
        // This verification ensures lockStatus eventually reflects database reality for UI consistency
        const { data: currentUser } = await client.auth.getUser()
        const currentUserId = currentUser.user?.id

        if (!currentUserId) {
          console.error('[useScriptLock] No current user ID')
          setLockStatus('locked')
          isAcquiringRef.current = false
          return
        }

        let verified = false
        let attempts = 0
        const maxAttempts = 10 // Max 1 second total wait (10 * 100ms)

        while (!verified && attempts < maxAttempts) {
          const { data: lockRecord, error: verifyError} = await scriptLocksTable(client)
            .select('locked_by')
            .eq('script_id', scriptId)
            .maybeSingle()

          if (verifyError) {
            console.error('[useScriptLock] Lock verification error:', verifyError)
            setLockStatus('locked')
            isAcquiringRef.current = false
            return
          }

          if (lockRecord) {
            // Lock exists in database - verify it's owned by us
            if (lockRecord.locked_by === currentUserId) {
              // OUR lock confirmed in database
              verified = true
              lockAcquisitionSucceededRef.current = true // Mark that our RPC call succeeded
              setLockStatus('acquired')
              setLockedBy({ id: lockResult.locked_by_user_id, name: lockResult.locked_by_name })
              console.log('[useScriptLock] Lock acquired and verified', {
                scriptId,
                attempts: attempts + 1,
                verificationTimeMs: (attempts + 1) * 100
              })
            } else {
              // Lock exists but owned by another user (race condition - we lost)
              console.log('[useScriptLock] Lock verification failed - lock held by another user')
              setLockStatus('locked')
              // Fetch other user's name for display
              const { data: profile } = await client
                .from('user_profiles')
                .select('display_name')
                .eq('id', lockRecord.locked_by)
                .maybeSingle()
              setLockedBy({
                id: lockRecord.locked_by,
                name: profile?.display_name || 'Unknown User'
              })
              isAcquiringRef.current = false
              return
            }
          } else {
            // Lock not visible yet, wait and retry
            attempts++
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
        }

        if (!verified) {
          console.error('[useScriptLock] Lock verification timeout - lock not found in database after', maxAttempts * 100, 'ms')
          setLockStatus('locked')
        }
      } else if (lockResult) {
        console.log('[useScriptLock] Lock already held by:', lockResult.locked_by_name)
        lockAcquisitionSucceededRef.current = false // Mark that our RPC call failed
        setLockStatus('locked')
        setLockedBy({ id: lockResult.locked_by_user_id || '', name: lockResult.locked_by_name || 'Unknown' })
      }
    } catch (err) {
      console.error('[useScriptLock] Lock acquisition failed:', err)
      lockAcquisitionSucceededRef.current = false // Mark that our RPC call failed
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
      // Set flag to prevent re-acquisition on DELETE event
      isManualReleaseRef.current = true
      lockAcquisitionSucceededRef.current = false // Reset acquisition flag

      await scriptLocksTable(client).delete().eq('script_id', scriptId)
      setLockStatus('unlocked')
      setLockedBy(null)

      // Reset flag after a delay (allows DELETE event to process)
      setTimeout(() => {
        isManualReleaseRef.current = false
      }, 1000)
    } catch (err) {
      console.error('Lock release failed:', err)
      isManualReleaseRef.current = false
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
      // Set unmounting flag to prevent re-acquisition
      isUnmountingRef.current = true

      // Unsubscribe from realtime channel FIRST (prevent DELETE event from triggering re-acquisition)
      if (channelRef.current) {
        client.removeChannel(channelRef.current)
        channelRef.current = null
      }

      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }

      // Clear any pending reacquisition timeout
      if (reacquisitionTimeoutRef.current) {
        clearTimeout(reacquisitionTimeoutRef.current)
        reacquisitionTimeoutRef.current = null
      }

      // Delete lock LAST (after channel removed)
      if (scriptId) {
        // Fire-and-forget deletion (cleanup must be synchronous)
        scriptLocksTable(client)
          .delete()
          .eq('script_id', scriptId)
          .then(({ error }: { error: unknown }) => {
            if (error) {
              console.error('[useScriptLock] Cleanup delete failed:', error)
            }
          })
          .catch((err: unknown) => {
            console.error('[useScriptLock] Cleanup delete error:', err)
          })
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
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Cancel any pending reacquisition attempts
            if (reacquisitionTimeoutRef.current) {
              clearTimeout(reacquisitionTimeoutRef.current)
              reacquisitionTimeoutRef.current = null
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newLock = payload.new as any

            // Fetch lock holder's name and current user ID
            const [profileResult, userResult] = await Promise.all([
              client.from('user_profiles').select('display_name').eq('id', newLock.locked_by).maybeSingle(),
              client.auth.getUser()
            ])

            const currentUserId = userResult.data.user?.id
            const isOwnLock = currentUserId === newLock.locked_by

            if (isOwnLock) {
              // This is our own lock acquisition - but only trust it if our RPC call succeeded
              // This prevents the case where two hooks for the same user try to acquire the same lock:
              // - Hook1 acquires lock (RPC succeeds, flag=true)
              // - Hook2 tries to acquire (RPC fails, flag=false)
              // - Hook2 receives INSERT event for Hook1's lock
              // - Without this check, Hook2 would incorrectly set lockStatus='acquired'
              if (lockAcquisitionSucceededRef.current) {
                setLockStatus('acquired')
                setLockedBy({
                  id: newLock.locked_by,
                  name: profileResult.data?.display_name || 'Unknown User'
                })
              } else {
                // Our RPC call failed, so we don't own this lock (race condition)
                console.log('[useScriptLock] Ignoring realtime INSERT - our acquisition RPC failed')
              }
            } else {
              // Lock is held by another user
              setLockStatus('locked')
              setLockedBy({
                id: newLock.locked_by,
                name: profileResult.data?.display_name || 'Unknown User'
              })
            }
          } else if (payload.eventType === 'DELETE') {
            // Lock released - debounce re-acquisition to allow INSERT events to process first
            // This prevents race conditions when lock is deleted then immediately re-inserted by another user
            if (!isManualReleaseRef.current) {
              // Clear any pending reacquisition
              if (reacquisitionTimeoutRef.current) {
                clearTimeout(reacquisitionTimeoutRef.current)
              }

              // Wait 100ms for potential INSERT event before attempting reacquisition
              reacquisitionTimeoutRef.current = setTimeout(() => {
                acquireLock()
              }, 100)
            }
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
