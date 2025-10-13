import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import { useAuth } from './contexts/AuthContext'

// Mock the AuthContext
vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: vi.fn()
}))

// Mock components that might not be ready yet
vi.mock('./components/TipTapEditor', () => ({
  TipTapEditor: () => <div data-testid="tiptap-editor">TipTap Editor</div>
}))

vi.mock('./components/TestRLS', () => ({
  TestRLS: () => <div data-testid="test-rls">Test RLS</div>
}))

const mockUseAuth = vi.mocked(useAuth)

function renderApp() {
  return render(<App />)
}

describe('App', () => {
  it('should render the app with auth provider', () => {
    mockUseAuth.mockReturnValue({
      currentUser: null,
      userProfile: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn()
    })

    renderApp()

    // App should render without crashing
    // The AuthProvider and Router are wired up
    expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument()
    expect(screen.getByText('Video Production Platform')).toBeInTheDocument()
  })
})