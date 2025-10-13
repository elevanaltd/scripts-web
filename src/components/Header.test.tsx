import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { User } from '@supabase/supabase-js'
import { Header } from './Header'
import { useAuth } from '../contexts/AuthContext'
import { useScriptStatus } from '../contexts/ScriptStatusContext'

// Mock the contexts
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

vi.mock('../contexts/ScriptStatusContext', () => ({
  useScriptStatus: vi.fn()
}))

const mockUseAuth = vi.mocked(useAuth)
const mockUseScriptStatus = vi.mocked(useScriptStatus)

describe('Header', () => {
  const mockLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock for script status context
    mockUseScriptStatus.mockReturnValue({
      scriptStatus: null,
      updateScriptStatus: vi.fn(),
      clearScriptStatus: vi.fn()
    })
  })

  it('should display user email when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      currentUser: { id: '123', email: 'test@example.com' } as User,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    render(<Header />)

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('should display logout button when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      currentUser: { id: '123', email: 'test@example.com' } as User,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    render(<Header />)

    const logoutButton = screen.getByRole('button', { name: /logout/i })
    expect(logoutButton).toBeInTheDocument()
  })

  it('should call logout function when logout button is clicked', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      currentUser: { id: '123', email: 'test@example.com' } as User,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    render(<Header />)

    const logoutButton = screen.getByRole('button', { name: /logout/i })
    fireEvent.click(logoutButton)

    expect(mockLogout).toHaveBeenCalledOnce()
  })

  it('should have professional styling classes', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      currentUser: { id: '123', email: 'test@example.com' } as User,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    const { container } = render(<Header />)
    const headerElement = container.firstChild as HTMLElement

    expect(headerElement).toHaveClass('app-header')
  })

  it('should display app title', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      currentUser: { id: '123', email: 'test@example.com' } as User,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    render(<Header />)

    expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument()
  })

  it('should display script status when provided', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      currentUser: { id: '123', email: 'test@example.com' } as User,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    const scriptStatus = {
      saveStatus: 'saved' as const,
      lastSaved: new Date('2024-01-01T12:00:00Z'),
      componentCount: 3
    }

    mockUseScriptStatus.mockReturnValue({
      scriptStatus,
      updateScriptStatus: vi.fn(),
      clearScriptStatus: vi.fn()
    })

    render(<Header />)

    expect(screen.getByText('saved')).toBeInTheDocument()
    expect(screen.getByText('3 components')).toBeInTheDocument()
    expect(screen.getByText('1/1/2024')).toBeInTheDocument()
  })

  it('should display different save status states', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      currentUser: { id: '123', email: 'test@example.com' } as User,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    // Test saving state
    mockUseScriptStatus.mockReturnValue({
      scriptStatus: { saveStatus: 'saving' as const, lastSaved: null, componentCount: 0 },
      updateScriptStatus: vi.fn(),
      clearScriptStatus: vi.fn()
    })

    const { rerender } = render(<Header />)
    expect(screen.getByText('saving')).toBeInTheDocument()

    // Test unsaved state
    mockUseScriptStatus.mockReturnValue({
      scriptStatus: { saveStatus: 'unsaved' as const, lastSaved: null, componentCount: 2 },
      updateScriptStatus: vi.fn(),
      clearScriptStatus: vi.fn()
    })

    rerender(<Header />)
    expect(screen.getByText('unsaved')).toBeInTheDocument()
    expect(screen.getByText('2 components')).toBeInTheDocument()

    // Test error state
    mockUseScriptStatus.mockReturnValue({
      scriptStatus: { saveStatus: 'error' as const, lastSaved: null, componentCount: 1 },
      updateScriptStatus: vi.fn(),
      clearScriptStatus: vi.fn()
    })

    rerender(<Header />)
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('should not display script status when not provided', () => {
    mockUseAuth.mockReturnValue({
      userProfile: null,
      currentUser: { id: '123', email: 'test@example.com' } as User,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      logout: mockLogout
    })

    // Use default mock (scriptStatus: null)

    render(<Header />)

    expect(screen.queryByText('saved')).not.toBeInTheDocument()
    expect(screen.queryByText('components')).not.toBeInTheDocument()
  })
})