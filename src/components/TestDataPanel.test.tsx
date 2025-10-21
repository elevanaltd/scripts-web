import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestDataPanel } from './TestDataPanel';
import { supabase } from '../lib/supabase';

// Mock Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

// Mock mappers
vi.mock('../lib/mappers/projectMapper', () => ({
  mapProjectRowsToProjects: vi.fn((rows) => {
    if (!rows) return [];
    return rows.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row: any) => ({ // Justification: Mock requires flexible input types
      id: row.id,
      title: row.title,
      eav_code: row.eav_code,
      due_date: row.due_date ?? undefined,
      project_phase: row.project_phase
    }));
  })
}));

vi.mock('../lib/mappers/videoMapper', () => ({
  mapVideoRowsToVideos: vi.fn((rows) => {
    if (!rows) return [];
    return rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((row: any) => row?.eav_code) // Justification: Mock filter needs flexible input
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((row: any) => ({ // Justification: Mock mapper handles test data shapes
      id: row.id,
      eav_code: row.eav_code,
      title: row.title,
      main_stream_status: row.main_stream_status ?? undefined,
      vo_stream_status: row.vo_stream_status ?? undefined
    }));
  })
}));

describe('TestDataPanel', () => {
  const mockProjects = [
    {
      id: 'proj-1',
      title: 'Project 1',
      eav_code: 'EAV001',
      due_date: '2024-12-31',
      project_phase: 'production',
      client_filter: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      final_invoice_sent: null
    },
    {
      id: 'proj-2',
      title: 'Project 2',
      eav_code: 'EAV002',
      due_date: null,
      project_phase: null,
      client_filter: null,
      created_at: null,
      updated_at: null,
      final_invoice_sent: null
    }
  ];

  const mockVideos = [
    {
      id: 'video-1',
      title: 'Video 1',
      eav_code: 'EAV001',
      main_stream_status: 'completed',
      vo_stream_status: 'pending',
      production_type: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'video-2',
      title: 'Video 2',
      eav_code: 'EAV001',
      main_stream_status: null,
      vo_stream_status: null,
      production_type: null,
      created_at: null,
      updated_at: null
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the test data panel', () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any) = mockFrom; // Justification: Mocking Supabase client requires bypassing types

    render(<TestDataPanel />);

    expect(screen.getByText(/Supabase Data Test Panel/)).toBeInTheDocument();
  });

  it('should load and display projects on mount', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockProjects,
          error: null
        })
      })
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any) = mockFrom; // Justification: Mocking Supabase client requires bypassing types

    render(<TestDataPanel />);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
      expect(screen.getByText('Project 2')).toBeInTheDocument();
    });

    expect(mockFrom).toHaveBeenCalledWith('projects');
  });

  it('should load videos when a project is clicked', async () => {
    const user = userEvent.setup();

    // Setup mock for projects
    const mockFromProjects = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockProjects,
          error: null
        })
      })
    });

    // Setup mock for videos
    const mockFromVideos = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockVideos,
            error: null
          })
        })
      })
    });

    // Switch between mocks based on table name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any) = vi.fn((table) => { // Justification: Mocking Supabase client requires bypassing types
      if (table === 'projects') return mockFromProjects();
      if (table === 'videos') return mockFromVideos();
    });

    render(<TestDataPanel />);

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
    });

    // Click on a project
    await user.click(screen.getByText('Project 1'));

    // Wait for videos to load
    await waitFor(() => {
      expect(screen.getByText('Video 1')).toBeInTheDocument();
      expect(screen.getByText('Video 2')).toBeInTheDocument();
    });
  });

  it('should handle errors when loading projects fails', async () => {
    const mockError = new Error('Failed to fetch projects');
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: mockError
        })
      })
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any) = mockFrom; // Justification: Mocking Supabase client requires bypassing types

    render(<TestDataPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load projects/)).toBeInTheDocument();
    });
  });

  it('should use mappers to transform Supabase data to domain models', async () => {
    const { mapProjectRowsToProjects } = await import('../lib/mappers/projectMapper');

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockProjects,
          error: null
        })
      })
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any) = mockFrom; // Justification: Mocking Supabase client requires bypassing types

    render(<TestDataPanel />);

    await waitFor(() => {
      expect(screen.getByText('Project 1')).toBeInTheDocument();
    });

    // Verify mappers are called with the data
    expect(mapProjectRowsToProjects).toHaveBeenCalledWith(mockProjects);
  });
});