import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Logger } from '../services/logger'
import { mapUserProfileRowToUserProfile } from '../lib/mappers/userProfileMapper'
import type { UserProfile } from '../lib/mappers/userProfileMapper'

interface AuthContextType {
  currentUser: User | null
  userProfile: UserProfile | null
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  // Function to load user profile - simplified
  const loadUserProfile = useCallback(async (userId: string, userEmail?: string, userName?: string) => {
    try {
      // First try to get existing profile
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()  // Use maybeSingle to avoid 406 errors

      if (data) {
        const mappedProfile = mapUserProfileRowToUserProfile(data)
        setUserProfile(mappedProfile)
      } else if (userEmail) {
        // Create profile if it doesn't exist
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: userEmail,
            display_name: userName || userEmail,
            role: 'client' // Default to client for security
          })
          .select()
          .single()

        if (insertError) {
          Logger.error('[AuthContext] Error creating user profile', { error: insertError.message })
        } else if (newProfile) {
          const mappedNewProfile = mapUserProfileRowToUserProfile(newProfile)
          setUserProfile(mappedNewProfile)
        }
      }
    } catch (err) {
      Logger.error('[AuthContext] Exception in loadUserProfile', { error: (err as Error).message })
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Check session with proper error handling and timeout
    // Create a proper timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Session check timeout after 2s')), 2000)
    })

    // Race between session check and timeout
    Promise.race([
      supabase.auth.getSession(),
      timeoutPromise
    ])
      .then((result) => {
        if (!mounted) {
          return
        }

        // Type assertion since we know this is the getSession result
        const sessionResult = result as Awaited<ReturnType<typeof supabase.auth.getSession>>
        const { data: { session }, error } = sessionResult

        if (error) {
          Logger.error('[AuthContext] Session check error', { error: error.message })
          setLoading(false)
          return
        }

        setCurrentUser(session?.user ?? null)

        // If we have a user, try to load profile (but don't block on it)
        if (session?.user) {
          // Don't await - just fire and forget the profile load
          loadUserProfile(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.full_name
          ).catch((err) => {
            Logger.error('[AuthContext] Profile load failed', { error: (err as Error).message })
          })
        }

        // Set loading to false immediately after getting session
        if (mounted) {
          setLoading(false)
        }
      })
      .catch((err) => {
        Logger.error('[AuthContext] Session check failed or timed out', { error: (err as Error).message })
        if (mounted) {
          setLoading(false)
        }
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return

        setCurrentUser(session?.user ?? null)

        if (session?.user) {
          // Fire and forget profile load - don't block
          loadUserProfile(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.full_name
          ).catch((err) => {
            Logger.error('[AuthContext] Profile load failed on auth change', { error: (err as Error).message })
          })
        } else {
          setUserProfile(null)

          // P1 Security Fix (2025-10-10): Invalidate ALL React Query caches on logout
          // Prevents cross-user data leakage from cached queries
          // Context: User A logs out → User B logs in → Must not see User A's cached data
          queryClient.clear()
          Logger.info('[AuthContext] Cleared all query caches on logout')
        }

        // Don't touch loading state on auth changes - only on initial load
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadUserProfile, queryClient])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      return { error }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      })
      return { error }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const value: AuthContextType = {
    currentUser,
    userProfile,
    signIn,
    signUp,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}