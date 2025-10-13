import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { renderWithProviders } from '../test/testUtils'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        data: { session: null }
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    }
  }
}))

// Test component to access AuthContext
function TestComponent() {
  const { currentUser, signIn, signUp, logout } = useAuth()

  return (
    <div>
      <div data-testid="user-status">
        {currentUser ? 'authenticated' : 'unauthenticated'}
      </div>
      <button onClick={() => signIn('test@example.com', 'password')}>
        Sign In
      </button>
      <button onClick={() => signUp('test@example.com', 'password', 'Test User')}>
        Sign Up
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should provide auth context to children', async () => {
    // Phase 2B Fix: Use renderWithProviders to wrap AuthProvider with QueryClientProvider
    // AuthProvider uses useQueryClient() internally (line 40 in AuthContext.tsx)
    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for async initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('unauthenticated')
    })

    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Sign Up')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })
})