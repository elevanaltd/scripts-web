import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { User } from '@supabase/supabase-js'
import { PrivateRoute } from './PrivateRoute'
import { useAuth } from '../../contexts/AuthContext'

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

const mockUseAuth = vi.mocked(useAuth)

function renderWithRouter(component: React.ReactElement, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {component}
    </MemoryRouter>
  )
}

describe('PrivateRoute', () => {
  const TestChild = () => <div data-testid="protected-content">Protected Content</div>

  it('should show loading when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      currentUser: null,
      userProfile: null,
      loading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn()
    })

    renderWithRouter(
      <PrivateRoute>
        <TestChild />
      </PrivateRoute>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('should redirect to login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      currentUser: null,
      userProfile: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn()
    })

    renderWithRouter(
      <PrivateRoute>
        <TestChild />
      </PrivateRoute>
    )

    // Should not show the protected content
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('should render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      currentUser: { id: '123', email: 'test@example.com' } as User,
      userProfile: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn()
    })

    renderWithRouter(
      <PrivateRoute>
        <TestChild />
      </PrivateRoute>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })
})