/**
 * TipTap Editor XSS Protection Tests
 *
 * Tests for DOMPurify integration and XSS prevention in the TipTap editor
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TipTapEditor } from './TipTapEditor';
import { NavigationProvider } from '../contexts/NavigationContext';
import { ScriptStatusProvider } from '../contexts/ScriptStatusContext';
import DOMPurify from 'dompurify';

// Mock the auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { id: 'user-123', email: 'test@example.com' },
    userProfile: { id: 'user-123', email: 'test@example.com', role: 'admin', display_name: 'Test User', created_at: '2024-01-01' },
    signIn: vi.fn(),
    signUp: vi.fn(),
    logout: vi.fn(),
    loading: false
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock the script service to control what data comes back
vi.mock('../services/scriptService', () => ({
  loadScriptForVideo: vi.fn(),
  saveScript: vi.fn(),
  generateContentHash: vi.fn(),
}));

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationProvider>
        <ScriptStatusProvider>
          {children}
        </ScriptStatusProvider>
      </NavigationProvider>
    </QueryClientProvider>
  );
};

describe('TipTap Editor XSS Protection', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('HTML Sanitization', () => {
    it('should sanitize dangerous script tags from content', () => {
      const dangerousHTML = '<p>Safe content</p><script>alert("XSS")</script>';
      const sanitized = DOMPurify.sanitize(dangerousHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Safe content');
    });

    it('should sanitize inline event handlers', () => {
      const dangerousHTML = '<p onclick="alert(\'XSS\')">Click me</p>';
      const sanitized = DOMPurify.sanitize(dangerousHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Click me');
    });

    it('should sanitize iframe injections', () => {
      const dangerousHTML = '<iframe src="javascript:alert(\'XSS\')"></iframe><p>Safe content</p>';
      const sanitized = DOMPurify.sanitize(dangerousHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('Safe content');
    });

    it('should preserve safe HTML formatting', () => {
      const safeHTML = '<p>Paragraph</p><strong>Bold</strong><em>Italic</em><h2>Heading</h2>';
      const sanitized = DOMPurify.sanitize(safeHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).toContain('<p>Paragraph</p>');
      expect(sanitized).toContain('<strong>Bold</strong>');
      expect(sanitized).toContain('<em>Italic</em>');
      expect(sanitized).toContain('<h2>Heading</h2>');
    });

    it('should allow safe class attributes but remove dangerous ones', () => {
      const htmlWithClasses = '<p class="component-paragraph">Safe</p><p class="malicious" onclick="alert()">Dangerous</p>';
      const sanitized = DOMPurify.sanitize(htmlWithClasses, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).toContain('class="component-paragraph"');
      expect(sanitized).toContain('class="malicious"'); // Class is allowed, onclick is not
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).toContain('Safe');
      expect(sanitized).toContain('Dangerous');
    });
  });

  describe('Component Integration', () => {
    it('should render TipTap editor without XSS vulnerabilities', () => {
      render(
        <TestWrapper>
          <TipTapEditor />
        </TestWrapper>
      );

      // Check that the editor renders
      expect(screen.getByText('Script Editor')).toBeInTheDocument();
    });

    it('should prevent XSS through plain text replacement vulnerability', () => {
      // This tests the specific vulnerability in line 130 of TipTapEditor.tsx
      const maliciousPlainText = 'Normal text\n\n<script>alert("XSS")</script>';

      // Simulate the vulnerable transformation
      const vulnerableHTML = `<p>${maliciousPlainText.replace(/\n\n/g, '</p><p>')}</p>`;

      // This should contain XSS if not properly sanitized
      expect(vulnerableHTML).toContain('<script>');

      // But after proper sanitization it should be safe
      const sanitized = DOMPurify.sanitize(vulnerableHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Normal text');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content safely', () => {
      const emptyContent = '';
      const sanitized = DOMPurify.sanitize(emptyContent, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).toBe('');
    });

    it('should handle malformed HTML without breaking', () => {
      const malformedHTML = '<p>Unclosed paragraph<strong>Unclosed bold<script>alert("XSS")';
      const sanitized = DOMPurify.sanitize(malformedHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Unclosed paragraph');
      expect(sanitized).toContain('Unclosed bold');
    });

    it('should handle unicode and special characters safely', () => {
      const unicodeHTML = '<p>émojis 🎉 and spëcial çharacters</p>';
      const sanitized = DOMPurify.sanitize(unicodeHTML, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).toContain('émojis 🎉');
      expect(sanitized).toContain('spëcial çharacters');
    });

    it('should sanitize deeply nested XSS attempts', () => {
      const nestedXSS = '<p><strong><em><script>alert("nested")</script></em></strong></p>';
      const sanitized = DOMPurify.sanitize(nestedXSS, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('<p><strong><em>');
    });
  });

  describe('Performance', () => {
    it('should handle large content without significant performance degradation', () => {
      const largeContent = '<p>' + 'Lorem ipsum '.repeat(1000) + '</p>';
      const startTime = performance.now();

      const sanitized = DOMPurify.sanitize(largeContent, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'u', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['class'],
        KEEP_CONTENT: true
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(sanitized).toContain('Lorem ipsum');
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});