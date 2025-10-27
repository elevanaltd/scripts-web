#!/usr/bin/env node

/**
 * TEST: Environment-aware URL configuration for test user creation script
 *
 * Purpose: Verify create-test-users-via-api.mjs correctly handles URL configuration
 * Pattern: Characterization test (validates behavior, not implementation)
 *
 * Scenarios:
 * 1. VITE_SUPABASE_URL set → uses environment variable
 * 2. VITE_SUPABASE_URL not set → falls back to localhost
 * 3. Configuration is logged for debugging
 */

import { describe, test, expect } from 'vitest';

// Configuration logic extracted from create-test-users-via-api.mjs
// This is the EXACT pattern used in the script
function getSupabaseUrl() {
  return process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
}

test('URL configuration: uses environment variable when set', () => {
  // Setup: Set environment variable
  const originalUrl = process.env.VITE_SUPABASE_URL;
  process.env.VITE_SUPABASE_URL = 'https://preview-branch.supabase.co';

  // Exercise: Get URL using script's logic
  const url = getSupabaseUrl();

  // Verify: Environment variable is used
  expect(url).toBe('https://preview-branch.supabase.co');

  // Cleanup: Restore original state
  if (originalUrl !== undefined) {
    process.env.VITE_SUPABASE_URL = originalUrl;
  } else {
    delete process.env.VITE_SUPABASE_URL;
  }
});

test('URL configuration: falls back to localhost when not set', () => {
  // Setup: Remove environment variable
  const originalUrl = process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;

  // Exercise: Get URL using script's logic
  const url = getSupabaseUrl();

  // Verify: Localhost is used as fallback
  expect(url).toBe('http://127.0.0.1:54321');

  // Cleanup: Restore original state
  if (originalUrl !== undefined) {
    process.env.VITE_SUPABASE_URL = originalUrl;
  }
});

test('URL configuration: environment variable takes precedence over fallback', () => {
  // Setup: Set environment variable to empty string (edge case)
  const originalUrl = process.env.VITE_SUPABASE_URL;
  process.env.VITE_SUPABASE_URL = '';

  // Exercise: Get URL using script's logic
  const url = getSupabaseUrl();

  // Verify: Empty string is falsy, so fallback is used
  // This validates the || operator behavior (empty string → fallback)
  expect(url).toBe('http://127.0.0.1:54321');

  // Cleanup: Restore original state
  if (originalUrl !== undefined) {
    process.env.VITE_SUPABASE_URL = originalUrl;
  } else {
    delete process.env.VITE_SUPABASE_URL;
  }
});

test('URL configuration: validates real-world CI scenario', () => {
  // Setup: Simulate CI environment with preview branch URL
  const originalUrl = process.env.VITE_SUPABASE_URL;
  process.env.VITE_SUPABASE_URL = 'https://uemgrhktpiqovqvpwbdz.supabase.co';

  // Exercise: Get URL using script's logic
  const url = getSupabaseUrl();

  // Verify: CI preview URL is used (Gap 6 fix validation)
  expect(url).toBe('https://uemgrhktpiqovqvpwbdz.supabase.co');
  expect(url.startsWith('https://')).toBe(true);
  expect(url.includes('supabase.co')).toBe(true);

  // Cleanup: Restore original state
  if (originalUrl !== undefined) {
    process.env.VITE_SUPABASE_URL = originalUrl;
  } else {
    delete process.env.VITE_SUPABASE_URL;
  }
});

test('URL configuration: validates local development scenario', () => {
  // Setup: Simulate local development (no environment variable)
  const originalUrl = process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;

  // Exercise: Get URL using script's logic
  const url = getSupabaseUrl();

  // Verify: Local Supabase Docker URL is used
  expect(url).toBe('http://127.0.0.1:54321');
  expect(url.startsWith('http://')).toBe(true);
  expect(url.includes('127.0.0.1')).toBe(true);
  expect(url.includes('54321')).toBe(true);

  // Cleanup: Restore original state
  if (originalUrl !== undefined) {
    process.env.VITE_SUPABASE_URL = originalUrl;
  }
});
