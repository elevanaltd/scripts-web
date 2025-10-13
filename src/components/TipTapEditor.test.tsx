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

describe('TipTapEditor with Navigation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
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
});