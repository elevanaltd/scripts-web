/**
 * TipTapEditor Tests - Enhanced with Navigation Integration
 *
 * Tests the updated TipTapEditor functionality including:
 * - Integration with NavigationContext
 * - Script loading and saving functionality
 * - Video selection handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TipTapEditor } from './TipTapEditor';
import { NavigationProvider } from '../contexts/NavigationContext';
import { ScriptStatusProvider } from '../contexts/ScriptStatusContext';
import { useScriptLock } from '../hooks/useScriptLock';
import { useCurrentScript } from '../core/state/useCurrentScript';

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

// Mock the script service
vi.mock('../services/scriptService', () => ({
  loadScriptForVideo: vi.fn().mockResolvedValue({
    id: 'script-123',
    video_id: 'video-123',
    content: '<p>Test script content</p>',
    components: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }),
  saveScript: vi.fn().mockResolvedValue({
    id: 'script-123',
    video_id: 'video-123',
    content: '<p>Updated content</p>',
    components: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  })
}));

// Mock TipTap editor
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn().mockReturnValue({
    commands: {
      setContent: vi.fn(),
      selectAll: vi.fn(),
      setTextSelection: vi.fn()
    },
    state: {
      doc: {
        forEach: vi.fn()
      }
    },
    getHTML: vi.fn().mockReturnValue('<p>Mock content</p>'),
    setEditable: vi.fn(), // Add setEditable method
    on: vi.fn(),
    off: vi.fn()
  }),
  EditorContent: vi.fn(() => <div data-testid="editor-content">Editor Content</div>)
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn()
  }
}));

// Mock useScriptLock to track invocations
vi.mock('../hooks/useScriptLock', () => ({
  useScriptLock: vi.fn()
}));

// Mock useCurrentScript
vi.mock('../core/state/useCurrentScript', () => ({
  useCurrentScript: vi.fn()
}));

describe('TipTapEditor with Navigation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation for useScriptLock
    vi.mocked(useScriptLock).mockReturnValue({
      lockStatus: 'unlocked',
      lockedBy: null,
      releaseLock: vi.fn().mockResolvedValue(undefined),
      requestEdit: vi.fn().mockResolvedValue(undefined),
      forceUnlock: vi.fn().mockResolvedValue(undefined)
    });
    // Default mock for useCurrentScript (no script selected)
    vi.mocked(useCurrentScript).mockReturnValue({
      currentScript: null,
      selectedVideo: null,
      save: vi.fn().mockResolvedValue(undefined),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      saveStatus: 'saved',
      setSaveStatus: vi.fn(),
      lastSaved: null,
      isLoading: false,
      componentCount: 0,
      isSaving: false,
      isUpdatingStatus: false,
      error: null,
      userRole: null
    });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  it('should render with navigation integration', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NavigationProvider>
          <ScriptStatusProvider>
            <TipTapEditor />
          </ScriptStatusProvider>
        </NavigationProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Script Editor')).toBeInTheDocument();
    expect(screen.getByText(/Select a video from the navigation to start editing/)).toBeInTheDocument();
  });

  it('should show "Select a video to edit" when no video selected', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <NavigationProvider>
          <ScriptStatusProvider>
            <TipTapEditor />
          </ScriptStatusProvider>
        </NavigationProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Select a Video to Edit')).toBeInTheDocument();
    expect(screen.getByText(/Choose a video from the navigation panel/)).toBeInTheDocument();
  });

  describe('ScriptLockContext Integration (TMG Blocker Resolution)', () => {
    it('should use ScriptLockContext instead of direct useScriptLock', () => {
      // GREEN: This test now passes after migration
      // TipTapEditor wraps content in ScriptLockProvider
      // ScriptLockProvider calls useScriptLock once
      // Internal components use useScriptLockContext

      render(
        <QueryClientProvider client={queryClient}>
          <NavigationProvider>
            <ScriptStatusProvider>
              <TipTapEditor />
            </ScriptStatusProvider>
          </NavigationProvider>
        </QueryClientProvider>
      );

      // Verify ScriptLockProvider called useScriptLock (context pattern active)
      // Expected: 1 invocation from ScriptLockProvider
      expect(vi.mocked(useScriptLock)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(useScriptLock)).toHaveBeenCalledWith(undefined); // No script selected
    });

    it('should prevent concurrent lock acquisitions with multiple consumers', () => {
      // REGRESSION TEST: Phase 3-4 scenario simulation
      // Verifies the architectural fix prevents lock stealing bug

      // Mock a selected script to trigger lock acquisition
      const mockCurrentScript = {
        id: 'test-script-123',
        video_id: 'video-456',
        plain_text: 'Test content',
        status: 'draft' as const,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        components: []
      };

      // Mock useCurrentScript to return our test script
      vi.mocked(useCurrentScript).mockReturnValue({
        currentScript: mockCurrentScript,
        selectedVideo: { id: 'video-456', title: 'Test Video', eav_code: 'V123' },
        save: vi.fn().mockResolvedValue(undefined),
        updateStatus: vi.fn().mockResolvedValue(undefined),
        saveStatus: 'saved',
        setSaveStatus: vi.fn(),
        lastSaved: new Date('2024-01-01T00:00:00Z'),
        isLoading: false,
        componentCount: 0,
        isSaving: false,
        isUpdatingStatus: false,
        error: null,
        userRole: 'admin'
      });

      render(
        <QueryClientProvider client={queryClient}>
          <NavigationProvider>
            <ScriptStatusProvider>
              <TipTapEditor />
            </ScriptStatusProvider>
          </NavigationProvider>
        </QueryClientProvider>
      );

      // CRITICAL: Only ONE useScriptLock invocation despite multiple consuming components
      // ScriptLockProvider owns the lock, children read via context
      expect(vi.mocked(useScriptLock)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(useScriptLock)).toHaveBeenCalledWith('test-script-123');

      // If this test passes, the architectural fix is working:
      // - ScriptLockProvider calls useScriptLock once
      // - TipTapEditorContent uses useScriptLockContext (not useScriptLock)
      // - Future: ScriptLockIndicator will also use useScriptLockContext
      // - Result: No lock stealing, no race conditions
    });
  });
});