/**
 * Test Utils - Characterization Tests
 *
 * Testguard: Test utilities are self-testing infrastructure
 * Purpose: Validate mockUseAuth helper produces correct mock structure
 */

import { describe, it, expect, vi } from 'vitest'
import { mockUseAuth, createMockUser, createMockUserProfile } from './testUtils'

describe('testUtils - Characterization Tests', () => {
  describe('mockUseAuth helper', () => {
    it('should create mock with default test user', () => {
      const mock = mockUseAuth()

      expect(mock.currentUser).toBeDefined()
      expect(mock.currentUser.id).toBe('test-user')
      expect(mock.currentUser.email).toBe('test@example.com')
      expect(mock.userProfile).toBeDefined()
      expect(mock.userProfile.role).toBe('admin')
      expect(mock.userProfile.display_name).toBe('Test User')
      expect(mock.loading).toBe(false)
      expect(mock.signIn).toBeInstanceOf(Function)
      expect(mock.signUp).toBeInstanceOf(Function)
      expect(mock.logout).toBeInstanceOf(Function)
    })

    it('should allow overriding user properties', () => {
      const mock = mockUseAuth({
        id: 'custom-user',
        email: 'custom@example.com',
        role: 'client',
        display_name: 'Custom User',
      })

      expect(mock.currentUser.id).toBe('custom-user')
      expect(mock.currentUser.email).toBe('custom@example.com')
      expect(mock.userProfile.role).toBe('client')
      expect(mock.userProfile.display_name).toBe('Custom User')
    })

    it('should create functions that are vi.fn() mocks', () => {
      const mock = mockUseAuth()

      expect(vi.isMockFunction(mock.signIn)).toBe(true)
      expect(vi.isMockFunction(mock.signUp)).toBe(true)
      expect(vi.isMockFunction(mock.logout)).toBe(true)
    })
  })

  describe('createMockUser', () => {
    it('should create Supabase User object with required fields', () => {
      const user = createMockUser({
        id: 'user-123',
        email: 'user@example.com',
      })

      expect(user.id).toBe('user-123')
      expect(user.email).toBe('user@example.com')
      expect(user.aud).toBe('authenticated')
      expect(user.role).toBe('authenticated')
      expect(user.created_at).toBeDefined()
      expect(user.app_metadata).toBeDefined()
      expect(user.user_metadata).toBeDefined()
    })
  })

  describe('createMockUserProfile', () => {
    it('should create UserProfile object with required fields', () => {
      const profile = createMockUserProfile({
        id: 'user-123',
        email: 'user@example.com',
        role: 'employee',
        display_name: 'Test Employee',
      })

      expect(profile.id).toBe('user-123')
      expect(profile.email).toBe('user@example.com')
      expect(profile.role).toBe('employee')
      expect(profile.display_name).toBe('Test Employee')
      expect(profile.created_at).toBeDefined()
    })

    it('should default to client role if not specified', () => {
      const profile = createMockUserProfile({
        id: 'user-123',
        email: 'user@example.com',
      })

      expect(profile.role).toBe('client')
    })
  })
})
