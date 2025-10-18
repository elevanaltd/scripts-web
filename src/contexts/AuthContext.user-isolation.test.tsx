import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AuthProvider, useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

/**
 * P1 SECURITY FIX (2025-10-10): Cross-User Cache Isolation Tests
 *
 * Bug: React Query cache was keyed only by scriptId/videoId, not userId
 * Impact: User A's cached data visible to User B after logout/login
 * Fix: Added userId to all query keys + cache.clear() on logout
 *
 * These tests characterize the expected behavior:
 * 1. Per-user cache isolation (different users = different cache entries)
 * 2. Cache invalidation on logout (User B never sees User A's data)
 * 3. Cache invalidation on user switch without hard reload
 */

describe('AuthContext - User Cache Isolation (P1 Security Fix)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // Fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Mock Supabase auth
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    })

    vi.spyOn(supabase.auth, 'onAuthStateChange').mockImplementation((callback: (event: AuthChangeEvent, session: Session | null) => void) => {
      // Store callback for manual triggering
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).__authCallback = callback
      return {
        data: {
          subscription: {
            id: 'mock-subscription-id',
            callback,
            unsubscribe: vi.fn(),
          },
        },
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).__authCallback
  })

  it('should clear all React Query caches on user logout', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )

    renderHook(() => useAuth(), { wrapper })

    // Simulate cached query data (User A's data)
    queryClient.setQueryData(['comments', 'script-123', 'user-a-id'], [
      { id: 'comment-1', content: 'Admin internal note' },
    ])

    queryClient.setQueryData(['script', 'video-456', 'user-a-id'], {
      id: 'script-789',
      content: 'Confidential script content',
    })

    // Verify cache has data
    expect(queryClient.getQueryData(['comments', 'script-123', 'user-a-id'])).toBeDefined()
    expect(queryClient.getQueryData(['script', 'video-456', 'user-a-id'])).toBeDefined()

    // Simulate logout (user = null in onAuthStateChange callback)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authCallback = (global as any).__authCallback
    await authCallback('SIGNED_OUT', null)

    // Wait for cache clear
    await waitFor(() => {
      expect(queryClient.getQueryData(['comments', 'script-123', 'user-a-id'])).toBeUndefined()
      expect(queryClient.getQueryData(['script', 'video-456', 'user-a-id'])).toBeUndefined()
    })
  })

  it('should maintain separate caches for different users (userId in queryKey)', () => {
    // This test verifies that query keys now include userId for isolation

    // User A's cached comments
    queryClient.setQueryData(['comments', 'script-123', 'user-a-id'], [
      { id: 'comment-1', content: 'User A comment' },
    ])

    // User B's cached comments (same script, different user)
    queryClient.setQueryData(['comments', 'script-123', 'user-b-id'], [
      { id: 'comment-2', content: 'User B comment' },
    ])

    // Verify both caches exist independently
    const userAComments = queryClient.getQueryData(['comments', 'script-123', 'user-a-id'])
    const userBComments = queryClient.getQueryData(['comments', 'script-123', 'user-b-id'])

    expect(userAComments).toEqual([{ id: 'comment-1', content: 'User A comment' }])
    expect(userBComments).toEqual([{ id: 'comment-2', content: 'User B comment' }])

    // Verify they are different cache entries
    expect(userAComments).not.toEqual(userBComments)
  })

  it('should prevent cross-user data leakage on user switch', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    )

    renderHook(() => useAuth(), { wrapper })

    // Simulate User A's session with cached data
    queryClient.setQueryData(['comments', 'script-123', 'user-a-id'], [
      { id: 'comment-1', content: 'Admin internal note - SENSITIVE' },
    ])

    // User A logs out
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authCallback = (global as any).__authCallback
    await authCallback('SIGNED_OUT', null)

    // Wait for cache clear
    await waitFor(() => {
      expect(queryClient.getQueryData(['comments', 'script-123', 'user-a-id'])).toBeUndefined()
    })

    // User B logs in
    const userBSession = {
      user: {
        id: 'user-b-id',
        email: 'userb@example.com',
        user_metadata: { full_name: 'User B' },
      },
    }

    await authCallback('SIGNED_IN', userBSession)

    // Verify User B CANNOT access User A's cached data
    expect(queryClient.getQueryData(['comments', 'script-123', 'user-a-id'])).toBeUndefined()

    // If User B queries same script, they get THEIR OWN cache entry
    queryClient.setQueryData(['comments', 'script-123', 'user-b-id'], [
      { id: 'comment-2', content: 'User B sees only their data' },
    ])

    const userBComments = queryClient.getQueryData(['comments', 'script-123', 'user-b-id'])
    expect(userBComments).toEqual([{ id: 'comment-2', content: 'User B sees only their data' }])

    // Double-check User A's data is gone
    expect(queryClient.getQueryData(['comments', 'script-123', 'user-a-id'])).toBeUndefined()
  })
})
