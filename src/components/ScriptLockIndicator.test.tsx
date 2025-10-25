/**
 * ScriptLockIndicator.test.tsx - Script Lock Indicator Component Tests
 *
 * Test Coverage Strategy (Approved by test-methodology-guardian):
 * - Priority: HIGH (loss of lock indicator causes user confusion and data loss)
 * - Target: 7 tests, ≥85% line coverage
 * - Approach: React Testing Library with mocked useScriptLock hook
 *
 * Critical Paths:
 * 1. Shows acquired status with green indicator
 * 2. Shows locked status with other user name
 * 3. Shows checking status with gray indicator
 * 4. Shows unlocked/lost status with red warning
 * 5. Allows user to release lock when acquired
 * 6. Allows admin to force unlock when locked by another
 * 7. Shows re-acquire button when lock is lost
 *
 * Constitutional Basis: TDD RED→GREEN→REFACTOR protocol
 *
 * **RIPPLE ANALYSIS:**
 * - LOCAL: ScriptLockIndicator component (new component)
 * - INTEGRATES: useScriptLock hook (existing, tested)
 * - AFFECTS: User visibility into lock state
 * - PREVENTS: User confusion when lock expires
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScriptLockIndicator } from './ScriptLockIndicator'
import * as useScriptLockModule from '../hooks/useScriptLock'

// Mock useScriptLock hook
vi.mock('../hooks/useScriptLock')

describe('ScriptLockIndicator', () => {
  const mockScriptId = '00000000-0000-0000-0000-000000000101'
  const mockReleaseLock = vi.fn()
  const mockRequestEdit = vi.fn()
  const mockForceUnlock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows acquired status with green indicator', () => {
    // RED: Component doesn't exist yet
    // GREEN: Component shows "You're editing" with green indicator
    // REFACTOR: Extract color constants, improve accessibility

    vi.spyOn(useScriptLockModule, 'useScriptLock').mockReturnValue({
      lockStatus: 'acquired',
      lockedBy: { id: 'user-123', name: 'Current User' },
      releaseLock: mockReleaseLock,
      requestEdit: mockRequestEdit,
      forceUnlock: mockForceUnlock,
    })

    render(<ScriptLockIndicator scriptId={mockScriptId} />)

    // Verify acquired status message
    expect(screen.getByText(/You're editing/i)).toBeInTheDocument()

    // Verify green indicator (accessible by role)
    const indicator = screen.getByRole('status')
    expect(indicator).toHaveClass('status-acquired') // Green styling

    // Verify "Release Lock" button present
    expect(screen.getByRole('button', { name: /Release Lock/i })).toBeInTheDocument()
  })

  it('shows locked status with other user name', () => {
    // RED: Component doesn't handle locked state yet
    // GREEN: Component shows "Locked by Jane Smith" with yellow indicator
    // REFACTOR: Extract lock holder display logic

    vi.spyOn(useScriptLockModule, 'useScriptLock').mockReturnValue({
      lockStatus: 'locked',
      lockedBy: { id: 'user-456', name: 'Jane Smith' },
      releaseLock: mockReleaseLock,
      requestEdit: mockRequestEdit,
      forceUnlock: mockForceUnlock,
    })

    render(<ScriptLockIndicator scriptId={mockScriptId} />)

    // Verify locked status message with user name
    expect(screen.getByText(/Locked by Jane Smith/i)).toBeInTheDocument()

    // Verify yellow indicator
    const indicator = screen.getByRole('status')
    expect(indicator).toHaveClass('status-locked') // Yellow styling

    // Verify "Request Edit" button present
    expect(screen.getByRole('button', { name: /Request Edit/i })).toBeInTheDocument()
  })

  it('shows checking status with gray indicator', () => {
    // RED: Component doesn't handle checking state yet
    // GREEN: Component shows "Checking lock status..." with gray indicator
    // REFACTOR: Ensure loading states are accessible

    vi.spyOn(useScriptLockModule, 'useScriptLock').mockReturnValue({
      lockStatus: 'checking',
      lockedBy: null,
      releaseLock: mockReleaseLock,
      requestEdit: mockRequestEdit,
      forceUnlock: mockForceUnlock,
    })

    render(<ScriptLockIndicator scriptId={mockScriptId} />)

    // Verify checking status message
    expect(screen.getByText(/Checking lock status/i)).toBeInTheDocument()

    // Verify gray indicator
    const indicator = screen.getByRole('status')
    expect(indicator).toHaveClass('status-checking') // Gray styling

    // Verify no action buttons during checking
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows unlocked/lost status with red warning', () => {
    // RED: Component doesn't handle unlocked state yet
    // GREEN: Component shows "⚠️ You lost edit lock" with red indicator
    // REFACTOR: Make warning prominent and accessible

    vi.spyOn(useScriptLockModule, 'useScriptLock').mockReturnValue({
      lockStatus: 'unlocked',
      lockedBy: null,
      releaseLock: mockReleaseLock,
      requestEdit: mockRequestEdit,
      forceUnlock: mockForceUnlock,
    })

    render(<ScriptLockIndicator scriptId={mockScriptId} />)

    // Verify unlocked warning message
    expect(screen.getByText(/You lost edit lock/i)).toBeInTheDocument()

    // Verify red indicator with warning icon
    const indicator = screen.getByRole('status')
    expect(indicator).toHaveClass('status-unlocked') // Red styling

    // Verify "Re-acquire Lock" button present
    expect(screen.getByRole('button', { name: /Re-acquire/i })).toBeInTheDocument()
  })

  it('allows user to release lock when acquired', async () => {
    // RED: Release lock button doesn't call releaseLock yet
    // GREEN: Clicking "Release Lock" calls releaseLock()
    // REFACTOR: Add confirmation dialog for safety

    const user = userEvent.setup()

    vi.spyOn(useScriptLockModule, 'useScriptLock').mockReturnValue({
      lockStatus: 'acquired',
      lockedBy: { id: 'user-123', name: 'Current User' },
      releaseLock: mockReleaseLock,
      requestEdit: mockRequestEdit,
      forceUnlock: mockForceUnlock,
    })

    render(<ScriptLockIndicator scriptId={mockScriptId} />)

    // Click "Release Lock" button
    const releaseButton = screen.getByRole('button', { name: /Release Lock/i })
    await user.click(releaseButton)

    // Verify releaseLock was called
    expect(mockReleaseLock).toHaveBeenCalledTimes(1)
  })

  it('allows user to request edit when locked by another', async () => {
    // RED: Request Edit button doesn't call requestEdit yet
    // GREEN: Clicking "Request Edit" calls requestEdit()
    // REFACTOR: Show feedback after request sent

    const user = userEvent.setup()

    vi.spyOn(useScriptLockModule, 'useScriptLock').mockReturnValue({
      lockStatus: 'locked',
      lockedBy: { id: 'user-456', name: 'Jane Smith' },
      releaseLock: mockReleaseLock,
      requestEdit: mockRequestEdit,
      forceUnlock: mockForceUnlock,
    })

    render(<ScriptLockIndicator scriptId={mockScriptId} />)

    // Click "Request Edit" button
    const requestButton = screen.getByRole('button', { name: /Request Edit/i })
    await user.click(requestButton)

    // Verify requestEdit was called
    expect(mockRequestEdit).toHaveBeenCalledTimes(1)
  })

  it('shows re-acquire button when lock is lost', async () => {
    // RED: Re-acquire button doesn't call requestEdit yet
    // GREEN: Clicking "Re-acquire Lock" calls requestEdit()
    // REFACTOR: Show loading state during re-acquisition

    const user = userEvent.setup()

    vi.spyOn(useScriptLockModule, 'useScriptLock').mockReturnValue({
      lockStatus: 'unlocked',
      lockedBy: null,
      releaseLock: mockReleaseLock,
      requestEdit: mockRequestEdit,
      forceUnlock: mockForceUnlock,
    })

    render(<ScriptLockIndicator scriptId={mockScriptId} />)

    // Click "Re-acquire Lock" button
    const reacquireButton = screen.getByRole('button', { name: /Re-acquire/i })
    await user.click(reacquireButton)

    // Verify requestEdit was called (re-acquisition uses same method)
    expect(mockRequestEdit).toHaveBeenCalledTimes(1)
  })
})
