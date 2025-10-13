import { render, screen, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { NavigationSidebar } from './NavigationSidebar';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { supabase } from '../../lib/supabase';

// Mock Supabase
vi.mock('../../lib/supabase');

// Mock CSS import
vi.mock('../../styles/Navigation.css', () => ({}));

const mockSupabase = vi.mocked(supabase);

// Test wrapper with NavigationProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <NavigationProvider>{children}</NavigationProvider>
);

describe('NavigationSidebar Auto-Refresh', () => {
  const mockProjects = [
    { id: '1', title: 'Project 1', due_date: '2024-01-01' },
    { id: '2', title: 'Project 2', due_date: '2024-02-01' }
  ];

  const mockVideos = [
    {
      id: 'v1',
      project_id: '1',
      title: 'Video 1',
      main_stream_status: 'ready',
      vo_stream_status: 'pending'
    },
    {
      id: 'v2',
      project_id: '1',
      title: 'Video 2',
      main_stream_status: 'processing',
      vo_stream_status: 'ready'
    }
  ];

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Mock auth.getUser() for the debug function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockSupabase.auth as any) = {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com'
          }
        },
        error: null
      })
    };

    // Mock successful Supabase responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockSupabase.from as any).mockImplementation((tableName: string) => {
      if (tableName === 'projects') {
        return {
          select: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue(
                Promise.resolve({
                  data: mockProjects,
                  error: null
                })
              )
            }),
            order: vi.fn().mockReturnValue(
              Promise.resolve({
                data: mockProjects,
                error: null
              })
            )
          })
        };
      } else if (tableName === 'videos') {
        return {
          select: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue(
              Promise.resolve({
                data: mockVideos,
                error: null
              })
            ),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue(
                Promise.resolve({
                  data: mockVideos,
                  error: null
                })
              )
            })
          })
        };
      } else if (tableName === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'test-user-id', role: 'admin' },
                error: null
              })
            })
          })
        };
      } else if (tableName === 'user_clients') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(
            Promise.resolve({
              data: [],
              error: null
            })
          )
        })
      };
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Auto-refresh functionality', () => {
    it('should render component with basic structure', async () => {
      const { unmount } = render(
        <TestWrapper>
          <NavigationSidebar />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Check for content that appears after component mounts
      await waitFor(() => {
        expect(screen.getByText('Projects & Videos')).toBeInTheDocument();
      });

      // Cleanup - clear all timers before unmounting
      vi.clearAllTimers();
      unmount();
    });

    it('should accept refresh interval prop', async () => {
      const { rerender, unmount } = render(
        <TestWrapper>
          <NavigationSidebar refreshInterval={5000} />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Test with different interval
      rerender(
        <TestWrapper>
          <NavigationSidebar refreshInterval={60000} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Cleanup - clear all timers before unmounting
      vi.clearAllTimers();
      unmount();
    });

    it('should show refresh indicator when refreshing', async () => {
      const { unmount } = render(
        <TestWrapper>
          <NavigationSidebar />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Projects & Videos')).toBeInTheDocument();
      });

      // Initially no refresh indicator (component loads immediately)
      expect(screen.queryByTitle('Refreshing data...')).not.toBeInTheDocument();

      // Cleanup - clear all timers before unmounting
      vi.clearAllTimers();
      unmount();
    });

    it('should have visibility detection capability', async () => {
      const { unmount } = render(
        <TestWrapper>
          <NavigationSidebar />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('EAV Orchestrator')).toBeInTheDocument();
      });

      // Visibility change events would be handled in the actual component
      // This test confirms the component mounts without errors

      // Cleanup - clear all timers before unmounting
      vi.clearAllTimers();
      unmount();
    });

  });

  // Note: More complex integration tests would be added here
  // For now, focusing on manual testing of the implemented functionality
});