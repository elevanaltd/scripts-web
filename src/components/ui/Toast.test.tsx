/**
 * Toast.test.tsx - Toast Component Tests
 *
 * Test Coverage Strategy (Approved by test-methodology-guardian):
 * - Priority: MEDIUM (loss of dismiss timers/variant styling hides user feedback)
 * - Target: 4 tests, ≥85% line coverage
 * - Approach: React Testing Library unit/integration, mock timers only
 *
 * Critical Paths:
 * 1. Auto-dismiss timer functionality
 * 2. Manual dismissal via close button
 * 3. Variant rendering (success/error/warning/info/loading)
 * 4. Stacked container ordering
 *
 * Constitutional Basis: TDD RED→GREEN→REFACTOR protocol
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toast, ToastContainer } from './Toast'
import type { ToastItem } from './useToast'

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should auto-dismiss toast after timeout', async () => {
    // RED: Test will fail if auto-dismiss doesn't work
    const onDismiss = vi.fn()

    render(<Toast message="Success!" type="success" duration={3000} onDismiss={onDismiss} />)

    // Toast should be visible initially
    expect(screen.getByText('Success!')).toBeInTheDocument()

    // Fast-forward timer to just before dismiss
    vi.advanceTimersByTime(2900)
    expect(screen.getByText('Success!')).toBeInTheDocument()

    // Fast-forward past dismiss time (including animation delay)
    vi.advanceTimersByTime(400) // 100ms to trigger + 300ms animation

    // Use waitFor with real timers to handle animation
    vi.useRealTimers()
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it('should manually dismiss toast on click', async () => {
    // RED: Test will fail if manual dismiss doesn't work
    const user = userEvent.setup({ delay: null })
    const onDismiss = vi.fn()

    render(<Toast message="Error occurred" type="error" onDismiss={onDismiss} />)

    // Wait for animation to start
    vi.advanceTimersByTime(20)

    // Click the toast to dismiss it
    const toast = screen.getByText('Error occurred').closest('.toast')
    expect(toast).toBeInTheDocument()

    await user.click(toast!)

    // Advance past animation delay (300ms)
    vi.advanceTimersByTime(350)

    // Switch to real timers for waitFor
    vi.useRealTimers()

    // Verify onDismiss was called
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    }, { timeout: 100 })
  })

  it('should render variant styles correctly (success, error, info, loading)', () => {
    // RED: Test will fail if variants don't render with correct styles/icons
    const variants = ['success', 'error', 'info', 'loading'] as const

    variants.forEach((variant) => {
      const { container, unmount } = render(
        <Toast message={`${variant} message`} type={variant} duration={0} />
      )

      const toast = container.querySelector('.toast')
      expect(toast).toBeInTheDocument()

      // Verify message is displayed
      expect(screen.getByText(`${variant} message`)).toBeInTheDocument()

      // Verify loading variant has spinner
      if (variant === 'loading') {
        const spinner = container.querySelector('.loading-spinner')
        expect(spinner).toBeInTheDocument()
      } else {
        // Other variants have icon text
        const iconMap = {
          success: '✓',
          error: '✕',
          info: 'ℹ'
        }
        const expectedIcon = iconMap[variant]
        const iconElement = container.querySelector('.toast-icon')
        expect(iconElement).toHaveTextContent(expectedIcon)
      }

      unmount()
    })
  })

  it('should stack multiple toasts correctly in container', () => {
    // RED: Test will fail if stacking doesn't preserve order
    const toasts: ToastItem[] = [
      { id: '1', message: 'First', type: 'info', duration: 0 },
      { id: '2', message: 'Second', type: 'success', duration: 0 },
      { id: '3', message: 'Third', type: 'error', duration: 0 }
    ]

    render(<ToastContainer toasts={toasts} />)

    // All toasts should be visible
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()

    // Verify stacking order (newer toasts appear below older ones in DOM)
    const toastElements = screen.getAllByText(/First|Second|Third/)
    expect(toastElements).toHaveLength(3)
    expect(toastElements[0]).toHaveTextContent('First')
    expect(toastElements[1]).toHaveTextContent('Second')
    expect(toastElements[2]).toHaveTextContent('Third')
  })
})
