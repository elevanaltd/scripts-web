import type { Tables } from '@elevanaltd/shared-lib/types';

/**
 * Valid user roles as per business requirements
 * SECURITY: Whitelist of allowed roles to prevent privilege escalation
 */
export type UserRole = 'admin' | 'employee' | 'client' | null;

/**
 * Domain model for UserProfile used in UI/State
 * Maps from Supabase Tables<'user_profiles'> with role validation
 */
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole; // VALIDATED: Only allowed values from whitelist
  created_at: string;
  client_filter?: string | null; // Optional field from joins
}

/**
 * Validates if a role string is in the allowed whitelist
 * SECURITY: Prevents injection of unauthorized roles
 *
 * @param role - Role string to validate
 * @returns true if role is valid, false otherwise
 */
export function isValidUserRole(role: string | null | undefined): role is UserRole {
  if (role === null) return true; // null is valid
  if (role === undefined) return false; // undefined is not valid

  const validRoles: UserRole[] = ['admin', 'employee', 'client', null];
  return validRoles.includes(role as UserRole);
}

/**
 * Validates and normalizes a user role
 * SECURITY: Invalid roles are normalized to null with warning
 *
 * @param role - Role string from database
 * @returns Validated role or null if invalid
 */
export function validateAndNormalizeRole(role: string | null): UserRole {
  if (isValidUserRole(role)) {
    return role as UserRole;
  }

  // SECURITY WARNING: Log invalid role attempts
  console.warn('[Security] Invalid user role detected:', role, '- normalizing to null');
  return null;
}

/**
 * Maps a Supabase user profile row to domain UserProfile model
 * SECURITY: Validates and normalizes role to prevent privilege escalation
 *
 * @param row - Supabase user profile row from database
 * @returns Domain UserProfile model with validated role
 * @throws Error if row is null/undefined
 */
export function mapUserProfileRowToUserProfile(
  row: Tables<'user_profiles'> & { client_filter?: string | null }
): UserProfile {
  if (!row) {
    throw new Error(`Cannot map ${row === null ? 'null' : 'undefined'} user profile row`);
  }

  const profile: UserProfile = {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: validateAndNormalizeRole(row.role), // SECURITY: Validate role
    created_at: row.created_at ?? new Date().toISOString()
  };

  // Include client_filter if present (from joins)
  if ('client_filter' in row) {
    profile.client_filter = row.client_filter;
  }

  return profile;
}