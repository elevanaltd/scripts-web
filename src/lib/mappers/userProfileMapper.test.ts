import { describe, it, expect } from 'vitest';
import { mapUserProfileRowToUserProfile, isValidUserRole, validateAndNormalizeRole } from './userProfileMapper';
import type { Tables } from '@elevanaltd/shared-lib/types';

describe('userProfileMapper', () => {
  describe('isValidUserRole', () => {
    it('should return true for valid roles', () => {
      expect(isValidUserRole('admin')).toBe(true);
      expect(isValidUserRole('employee')).toBe(true);
      expect(isValidUserRole('client')).toBe(true);
      expect(isValidUserRole(null)).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(isValidUserRole('superadmin')).toBe(false);
      expect(isValidUserRole('guest')).toBe(false);
      expect(isValidUserRole('user')).toBe(false);
      expect(isValidUserRole('')).toBe(false);
      expect(isValidUserRole('ADMIN')).toBe(false); // case sensitive
    });

    it('should return false for undefined', () => {
      expect(isValidUserRole(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any // Justification: Testing type guard requires untyped input
      )).toBe(false);
    });
  });

  describe('validateAndNormalizeRole', () => {
    it('should return valid roles unchanged', () => {
      expect(validateAndNormalizeRole('admin')).toBe('admin');
      expect(validateAndNormalizeRole('employee')).toBe('employee');
      expect(validateAndNormalizeRole('client')).toBe('client');
      expect(validateAndNormalizeRole(null)).toBe(null);
    });

    it('should return null for invalid roles with security warning', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(validateAndNormalizeRole('hacker')).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Invalid user role detected:',
        'hacker',
        '- normalizing to null'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty string as invalid', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(validateAndNormalizeRole('')).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('mapUserProfileRowToUserProfile', () => {
    it('should transform a valid Supabase user profile row to domain UserProfile', () => {
      const supabaseRow: Tables<'user_profiles'> = {
        id: 'user-1',
        email: 'admin@example.com',
        display_name: 'Admin User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z'
      };

      const result = mapUserProfileRowToUserProfile(supabaseRow);

      expect(result).toEqual({
        id: 'user-1',
        email: 'admin@example.com',
        display_name: 'Admin User',
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z'
      });
    });

    it('should handle null role correctly', () => {
      const supabaseRow: Tables<'user_profiles'> = {
        id: 'user-2',
        email: 'new@example.com',
        display_name: null,
        role: null,
        created_at: '2024-01-01T00:00:00Z'
      };

      const result = mapUserProfileRowToUserProfile(supabaseRow);

      expect(result).toEqual({
        id: 'user-2',
        email: 'new@example.com',
        display_name: null,
        role: null,
        created_at: '2024-01-01T00:00:00Z'
      });
    });

    it('should normalize invalid role to null with security warning', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const supabaseRow: Tables<'user_profiles'> = {
        id: 'user-3',
        email: 'suspicious@example.com',
        display_name: 'Suspicious User',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: 'superadmin' as any, // Justification: Simulating database corruption with invalid role
        created_at: '2024-01-01T00:00:00Z'
      };

      const result = mapUserProfileRowToUserProfile(supabaseRow);

      expect(result).toEqual({
        id: 'user-3',
        email: 'suspicious@example.com',
        display_name: 'Suspicious User',
        role: null, // Normalized to null for security
        created_at: '2024-01-01T00:00:00Z'
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Security] Invalid user role detected:',
        'superadmin',
        '- normalizing to null'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle created_at as null', () => {
      const supabaseRow: Tables<'user_profiles'> = {
        id: 'user-4',
        email: 'nocreated@example.com',
        display_name: 'No Created Date',
        role: 'employee',
        created_at: null
      };

      const result = mapUserProfileRowToUserProfile(supabaseRow);

      // Verify created_at is set to a valid ISO timestamp (avoid race condition by checking structure)
      expect(result.id).toBe('user-4');
      expect(result.email).toBe('nocreated@example.com');
      expect(result.display_name).toBe('No Created Date');
      expect(result.role).toBe('employee');
      expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/); // ISO 8601 format
      expect(new Date(result.created_at).getTime()).toBeGreaterThan(Date.now() - 1000); // Within last second
    });

    it('should throw error if user profile row is null', () => {
      expect(() => mapUserProfileRowToUserProfile(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any // Justification: Testing null coercion requires untyped null
      ))
        .toThrow('Cannot map null user profile row');
    });

    it('should throw error if user profile row is undefined', () => {
      expect(() => mapUserProfileRowToUserProfile(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any // Justification: Testing undefined coercion requires bypassing types
      ))
        .toThrow('Cannot map undefined user profile row');
    });

    it('should include client_filter when present', () => {
      const supabaseRow: Tables<'user_profiles'> & { client_filter?: string | null } = {
        id: 'user-5',
        email: 'client@example.com',
        display_name: 'Client User',
        role: 'client',
        created_at: '2024-01-01T00:00:00Z',
        client_filter: 'CLIENT001' // Extended property from join
      };

      const result = mapUserProfileRowToUserProfile(supabaseRow);

      expect(result).toEqual({
        id: 'user-5',
        email: 'client@example.com',
        display_name: 'Client User',
        role: 'client',
        created_at: '2024-01-01T00:00:00Z',
        client_filter: 'CLIENT001'
      });
    });
  });
});