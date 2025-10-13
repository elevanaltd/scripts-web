/**
 * usePermissions Hook Tests
 *
 * RED Phase: Failing tests define permission model behavior
 * Tests written BEFORE implementation per constitutional TDD requirement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from './usePermissions';
import { useAuth } from '../contexts/AuthContext';

// Mock the useAuth hook
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unauthenticated Users', () => {
    it('should deny all permissions when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        currentUser: null,
        userProfile: null,
        loading: false,
      });

      const { result } = renderHook(() => usePermissions());

      expect(result.current).toEqual({
        canEditScript: false,
        canComment: false,
        canChangeWorkflowStatus: false,
        canResolveComments: false,
        canEditComments: false,
        canDeleteComments: false,
      });
    });
  });

  describe('Client Users (Read-Only + Comment)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        currentUser: { id: 'client-1', email: 'client@example.com' },
        userProfile: {
          id: 'client-1',
          email: 'client@example.com',
          role: 'client',
          display_name: 'Test Client',
        },
        loading: false,
      });
    });

    it('should deny script editing permission for clients', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canEditScript).toBe(false);
    });

    it('should allow commenting for clients', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canComment).toBe(true);
    });

    it('should deny workflow status changes for clients', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canChangeWorkflowStatus).toBe(false);
    });

    it('should allow comment management for clients (own comments)', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canResolveComments).toBe(true);
      expect(result.current.canEditComments).toBe(true);
      expect(result.current.canDeleteComments).toBe(true);
    });
  });

  describe('Employee Users (Internal)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        currentUser: { id: 'employee-1', email: 'employee@example.com' },
        userProfile: {
          id: 'employee-1',
          email: 'employee@example.com',
          role: 'employee',
          display_name: 'Test Employee',
        },
        loading: false,
      });
    });

    it('should allow script editing for employees', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canEditScript).toBe(true);
    });

    it('should allow commenting for employees', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canComment).toBe(true);
    });

    it('should allow workflow status changes for employees', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canChangeWorkflowStatus).toBe(true);
    });

    it('should allow comment management for employees', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canResolveComments).toBe(true);
      expect(result.current.canEditComments).toBe(true);
      expect(result.current.canDeleteComments).toBe(true);
    });
  });

  describe('Admin Users (Internal)', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        currentUser: { id: 'admin-1', email: 'admin@example.com' },
        userProfile: {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
          display_name: 'Test Admin',
        },
        loading: false,
      });
    });

    it('should allow script editing for admins', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canEditScript).toBe(true);
    });

    it('should allow commenting for admins', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canComment).toBe(true);
    });

    it('should allow workflow status changes for admins', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canChangeWorkflowStatus).toBe(true);
    });

    it('should allow comment management for admins', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canResolveComments).toBe(true);
      expect(result.current.canEditComments).toBe(true);
      expect(result.current.canDeleteComments).toBe(true);
    });
  });

  describe('Permission Model Invariants', () => {
    it('should return consistent permission object structure regardless of role', () => {
      const roles = ['client', 'employee', 'admin'];
      const permissionKeys = [
        'canEditScript',
        'canComment',
        'canChangeWorkflowStatus',
        'canResolveComments',
        'canEditComments',
        'canDeleteComments',
      ];

      roles.forEach((role) => {
        mockUseAuth.mockReturnValue({
          currentUser: { id: 'user-1', email: 'user@example.com' },
          userProfile: {
            id: 'user-1',
            email: 'user@example.com',
            role,
            display_name: 'Test User',
          },
          loading: false,
        });

        const { result } = renderHook(() => usePermissions());

        // Verify all expected keys exist
        permissionKeys.forEach((key) => {
          expect(result.current).toHaveProperty(key);
          expect(typeof result.current[key as keyof typeof result.current]).toBe('boolean');
        });

        // Verify no unexpected keys
        expect(Object.keys(result.current).sort()).toEqual(permissionKeys.sort());
      });
    });
  });
});
