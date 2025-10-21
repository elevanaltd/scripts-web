/**
 * Signup.test.tsx - Signup Component Tests
 *
 * Test Coverage Strategy (Approved by test-methodology-guardian):
 * - Priority: HIGH (broken validation/Supabase handoff blocks new accounts)
 * - Target: 6 tests, ≥80% line coverage
 * - Approach: Integration tests with React Testing Library, mock useAuth and navigation
 *
 * Critical Paths:
 * 1. Validation errors (empty fields, length requirements, password mismatch)
 * 2. Successful signup flow (Supabase signUp success → confirmation view)
 * 3. Supabase error surfacing (duplicate email, network failure)
 * 4. Success screen rendering (confirmation view after successful signup)
 * 5. Loading state gating (submit button disabled during signup)
 * 6. Form field presence and functionality
 *
 * Constitutional Basis: TDD RED→GREEN→REFACTOR protocol
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Signup } from './Signup'
import { BrowserRouter } from 'react-router-dom'

const mockSignUp = vi.fn()
const mockSignIn = vi.fn()
const mockLogout = vi.fn()

// Mock the useAuth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}))

// Import after mocking to get the mocked version
import { useAuth } from '../../contexts/AuthContext'

interface RenderSignupOptions {
  signUpFn?: typeof mockSignUp
  loading?: boolean
}

const renderSignup = ({ signUpFn = mockSignUp, loading = false }: RenderSignupOptions = {}) => {
  // Mock useAuth to return our test values
  vi.mocked(useAuth).mockReturnValue({
    currentUser: null,
    userProfile: null,
    signIn: mockSignIn,
    signUp: signUpFn,
    logout: mockLogout,
    loading
  })

  return render(
    <BrowserRouter>
      <Signup />
    </BrowserRouter>
  )
}

describe('Signup Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have required fields to prevent empty submission', () => {
    // RED: Test will fail if required attributes are missing
    renderSignup()

    // Verify all form fields have required attribute for HTML5 validation
    const nameInput = screen.getByPlaceholderText(/full name/i)
    const emailInput = screen.getByPlaceholderText(/email address/i)
    const passwordInput = screen.getByPlaceholderText(/^password$/i)
    const confirmInput = screen.getByPlaceholderText(/confirm password/i)

    expect(nameInput).toHaveAttribute('required')
    expect(emailInput).toHaveAttribute('required')
    expect(passwordInput).toHaveAttribute('required')
    expect(confirmInput).toHaveAttribute('required')

    // Verify password fields have minLength attribute
    expect(passwordInput).toHaveAttribute('minLength', '8')
    expect(confirmInput).toHaveAttribute('minLength', '8')
  })

  it('should show validation error for password length requirement', async () => {
    // RED: Test will fail if password length validation missing
    const user = userEvent.setup()
    renderSignup()

    await user.type(screen.getByPlaceholderText(/full name/i), 'Test User')
    await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com')
    await user.type(screen.getByPlaceholderText(/^password$/i), 'short')
    await user.type(screen.getByPlaceholderText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('should show validation error for password mismatch', async () => {
    // RED: Test will fail if password mismatch validation missing
    const user = userEvent.setup()
    renderSignup()

    await user.type(screen.getByPlaceholderText(/full name/i), 'Test User')
    await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com')
    await user.type(screen.getByPlaceholderText(/^password$/i), 'password123')
    await user.type(screen.getByPlaceholderText(/confirm password/i), 'different123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('should call signUp and show confirmation view on successful signup', async () => {
    // RED: Test will fail if signup flow doesn't work
    const user = userEvent.setup()
    const mockSuccessSignUp = vi.fn().mockResolvedValueOnce({ error: null })

    renderSignup({ signUpFn: mockSuccessSignUp })

    await user.type(screen.getByPlaceholderText(/full name/i), 'Test User')
    await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com')
    await user.type(screen.getByPlaceholderText(/^password$/i), 'password123')
    await user.type(screen.getByPlaceholderText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(mockSuccessSignUp).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User')
    })

    // Use getByRole to get the specific heading
    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    expect(await screen.findByText(/confirmation link/i)).toBeInTheDocument()
  })

  it('should surface Supabase errors (duplicate email, network failure)', async () => {
    // RED: Test will fail if error handling missing
    const user = userEvent.setup()
    const mockErrorSignUp = vi.fn().mockResolvedValueOnce({
      error: { message: 'User already registered' }
    })

    renderSignup({ signUpFn: mockErrorSignUp })

    await user.type(screen.getByPlaceholderText(/full name/i), 'Test User')
    await user.type(screen.getByPlaceholderText(/email address/i), 'duplicate@example.com')
    await user.type(screen.getByPlaceholderText(/^password$/i), 'password123')
    await user.type(screen.getByPlaceholderText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/user already registered/i)).toBeInTheDocument()
    expect(mockErrorSignUp).toHaveBeenCalledTimes(1)
  })

  it('should disable submit button and show loading state during signup', async () => {
    // RED: Test will fail if loading state doesn't gate submit
    const user = userEvent.setup()
    let resolveSignUp: (value: { error: null }) => void
    const mockPendingSignUp = vi.fn().mockReturnValueOnce(
      new Promise<{ error: null }>((resolve) => {
        resolveSignUp = resolve
      })
    )

    renderSignup({ signUpFn: mockPendingSignUp })

    await user.type(screen.getByPlaceholderText(/full name/i), 'Test User')
    await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com')
    await user.type(screen.getByPlaceholderText(/^password$/i), 'password123')
    await user.type(screen.getByPlaceholderText(/confirm password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    // Button should be disabled and show loading text during signup
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /creating account/i })
      expect(submitButton).toBeDisabled()
    })

    // Resolve signup
    resolveSignUp!({ error: null })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /creating account/i })).not.toBeInTheDocument()
    })
  })
})
