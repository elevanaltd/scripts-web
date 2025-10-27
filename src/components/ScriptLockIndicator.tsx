/**
 * ScriptLockIndicator.tsx - Visual Lock Status Indicator
 *
 * **PURPOSE**: Provide visual feedback about script edit lock status
 *
 * **USER PROBLEM SOLVED**:
 * - User sees "You no longer hold edit lock" error without warning
 * - No visual feedback when lock expires (5 min heartbeat failure)
 * - Confusion about who is editing a script
 *
 * **VISUAL STATES**:
 * 1. Acquired (Green): "You're editing" - user has active lock
 * 2. Locked (Yellow): "Locked by Jane Smith" - another user has lock
 * 3. Checking (Gray): "Checking lock status..." - initial load/re-check
 * 4. Unlocked (Red): "⚠️ You lost edit lock" - lock expired, needs re-acquisition
 *
 * **ARCHITECTURE**:
 * - Uses useScriptLock hook (Phase 2 - tested and working)
 * - Integrates with TipTapEditor (Phase 4 - next)
 * - Co-located tests (ScriptLockIndicator.test.tsx)
 *
 * **RIPPLE ANALYSIS**:
 * - LOCAL: Component rendering and styling
 * - INTEGRATES: useScriptLock hook (no changes needed)
 * - AFFECTS: User visibility into lock state
 * - ENABLES: Phase 4 editor readonly integration
 */

import React from 'react'
import { useScriptLock } from '../hooks/useScriptLock'
import './ScriptLockIndicator.css'

export interface ScriptLockIndicatorProps {
  scriptId: string
  className?: string
}

// Lock status configuration interface
interface LockStatusConfig {
  message: string
  icon: string
  buttonLabel: string | null
  buttonAction: (() => Promise<void>) | null
  ariaLabel: string
}

// Status configuration factory - extract locked user name for better separation
function createStatusConfig(
  lockStatus: 'acquired' | 'locked' | 'checking' | 'unlocked',
  lockedByName: string | null,
  releaseLock: () => Promise<void>,
  requestEdit: () => Promise<void>
): LockStatusConfig {
  const configs: Record<string, LockStatusConfig> = {
    acquired: {
      message: "You're editing",
      icon: '✓',
      buttonLabel: 'Release Lock',
      buttonAction: releaseLock,
      ariaLabel: 'Lock acquired - you are currently editing this script',
    },
    locked: {
      message: `Locked by ${lockedByName || 'Unknown User'}`,
      icon: '🔒',
      buttonLabel: 'Request Edit',
      buttonAction: requestEdit,
      ariaLabel: `Lock held by ${lockedByName || 'another user'}`,
    },
    checking: {
      message: 'Checking lock status...',
      icon: '⏳',
      buttonLabel: null,
      buttonAction: null,
      ariaLabel: 'Checking lock status',
    },
    unlocked: {
      message: '⚠️ You lost edit lock',
      icon: '⚠️',
      buttonLabel: 'Re-acquire Lock',
      buttonAction: requestEdit,
      ariaLabel: 'Lock lost - click to re-acquire',
    },
  }

  return configs[lockStatus]
}

/**
 * ScriptLockIndicator - Shows lock status with visual indicators
 *
 * @param scriptId - UUID of script to show lock status for
 * @param className - Optional additional CSS classes
 *
 * **USAGE**:
 * ```tsx
 * <ScriptLockIndicator scriptId={script.id} />
 * ```
 *
 * **ACCESSIBILITY**:
 * - role="status" for screen readers (live region)
 * - aria-label describes lock state
 * - aria-hidden on decorative icons
 * - Keyboard accessible buttons
 *
 * **REFACTORING**:
 * - Extracted status config to factory function
 * - Improved type safety with LockStatusConfig interface
 * - Clear separation between display and logic
 */
export function ScriptLockIndicator({ scriptId, className = '' }: ScriptLockIndicatorProps) {
  const { lockStatus, lockedBy, releaseLock, requestEdit } = useScriptLock(scriptId)

  // Generate status configuration
  const config = createStatusConfig(lockStatus, lockedBy?.name || null, releaseLock, requestEdit)

  return (
    <div
      className={`script-lock-indicator status-${lockStatus} ${className}`}
      role="status"
      aria-label={config.ariaLabel}
      aria-live="polite" // Announce status changes to screen readers
    >
      <span className="lock-status-icon" aria-hidden="true">
        {config.icon}
      </span>
      <span className="lock-status-message">{config.message}</span>
      {config.buttonAction && config.buttonLabel && (
        <button
          className="lock-action-button"
          onClick={config.buttonAction}
          aria-label={config.buttonLabel}
          type="button" // Explicit button type
        >
          {config.buttonLabel}
        </button>
      )}
    </div>
  )
}
