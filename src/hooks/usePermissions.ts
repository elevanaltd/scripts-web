/**
 * usePermissions Hook - Centralized Permission Logic
 *
 * Critical-Engineer: consulted for Architecture pattern selection (Hybrid Refactor)
 * Verdict: Extract permission logic FIRST, apply fixes to clean architecture
 *
 * This hook provides declarative permission checks based on user role.
 * Prevents "edit then error" UX by controlling what actions are even presented to users.
 *
 * North Star Alignment:
 * - Clients: READ + COMMENT only (no script editing, no workflow changes)
 * - Admin/Employee: Full access to all features
 */

import { useAuth } from '../contexts/AuthContext';

export interface Permissions {
  /** Can edit script content (type, paste, modify text) */
  canEditScript: boolean;

  /** Can create comments on script text */
  canComment: boolean;

  /** Can change workflow status (draft, in_review, rework, approved) */
  canChangeWorkflowStatus: boolean;

  /** Can resolve/unresolve comments */
  canResolveComments: boolean;

  /** Can edit own comments */
  canEditComments: boolean;

  /** Can delete own comments */
  canDeleteComments: boolean;
}

/**
 * Hook that returns permission flags based on current user's role
 *
 * Permission Model:
 * - Clients: Read-only scripts + commenting capability
 * - Admin/Employee: Full editing + workflow management
 * - Unauthenticated: No permissions (all false)
 */
export const usePermissions = (): Permissions => {
  const { userProfile } = useAuth();

  // Unauthenticated users have no permissions
  if (!userProfile) {
    return {
      canEditScript: false,
      canComment: false,
      canChangeWorkflowStatus: false,
      canResolveComments: false,
      canEditComments: false,
      canDeleteComments: false,
    };
  }

  // Determine if user is internal (admin or employee)
  // Handle null role gracefully (treat as non-internal)
  const isInternal = userProfile.role !== null && (userProfile.role === 'admin' || userProfile.role === 'employee');

  return {
    // Script editing: Internal users only
    canEditScript: isInternal,

    // Commenting: All authenticated users can comment
    canComment: true,

    // Workflow status changes: Internal users only
    canChangeWorkflowStatus: isInternal,

    // Comment management: All authenticated users can manage their own comments
    canResolveComments: true,
    canEditComments: true,
    canDeleteComments: true,
  };
};
