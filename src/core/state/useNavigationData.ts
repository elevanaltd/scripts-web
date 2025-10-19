/**
 * useNavigationData.ts - Navigation Sidebar Data Hook
 *
 * CONSTITUTIONAL MANDATE: Step 2.4 - NavigationSidebar Extraction
 * Extracts: Data fetching, auto-refresh, visibility optimization from NavigationSidebar.tsx
 * Preserves: Race condition fix (functional state updates), visibility detection, error handling
 *
 * Architecture:
 * - Extracted from: NavigationSidebar.tsx Lines 34-244 (~210 LOC)
 * - Complexity: ~150-200 LOC (data layer)
 * - Component: ~220 LOC (pure UI orchestrator)
 * - Monorepo-ready: Enables packages/state-navigation/
 *
 * Pattern: Follows Task 2.1 (useCurrentScript) and Task 2.2 (useCommentSidebar)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { validateProjectId, ValidationError } from '../../lib/validation';
import { Logger } from '../../services/logger';
import type { Project, Video } from '../../contexts/NavigationContext';
import { mapProjectRowToProject, mapProjectRowsToProjects } from '../../lib/mappers/projectMapper';
import { mapVideoRowsToVideos } from '../../lib/mappers/videoMapper';

export interface UseNavigationDataConfig {
  refreshInterval?: number;
  autoRefresh?: boolean;
}

/**
 * Navigation data hook - encapsulates project/video data fetching and auto-refresh
 *
 * Returns:
 * - Data: projects, videos (grouped by eav_code), loading, error, isRefreshing
 * - Methods: loadVideos (for expand), refreshData (manual refresh)
 *
 * Features:
 * - Auto-refresh with configurable interval (default 30s)
 * - Visibility detection (pauses refresh when document hidden)
 * - Race condition prevention (functional state updates)
 * - Error handling with Logger integration
 */
export function useNavigationData(config?: UseNavigationDataConfig) {
  const {
    refreshInterval = 30000,
    autoRefresh = true,
  } = config || {};

  // ========== STATE MANAGEMENT ==========
  // Extracted from NavigationSidebar.tsx Lines 34-40
  const [projects, setProjects] = useState<Project[]>([]);
  const [videos, setVideos] = useState<Record<string, Video[]>>({});
  const [loading, setLoading] = useState(autoRefresh); // Only load initially if auto-refresh enabled
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Visibility detection state (Lines 42-43)
  const [isVisible, setIsVisible] = useState(!document.hidden);

  // Expanded projects tracking for refresh (internal)
  const expandedProjectsRef = useRef<Set<string>>(new Set());

  // Projects ref to avoid stale closures in loadVideos
  const projectsRef = useRef<Project[]>(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // ========== VISIBILITY DETECTION ==========
  // Extracted from Lines 46-55
  // Optimization: Pause auto-refresh when sidebar not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // ========== DATA FETCHING - PROJECTS ==========
  // Extracted from Lines 102-153
  const loadProjects = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch projects that meet phase criteria
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .not('project_phase', 'in', '("Completed","Not Proceeded With")')
        .order('title');

      if (projectError) throw projectError;

      // Fetch all videos to determine which projects have videos
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('eav_code')
        .not('eav_code', 'is', null);

      if (videoError) throw videoError;

      // Create set of eav_codes that have videos (filter out null eav_codes)
      const eavCodesWithVideos = new Set(
        (videoData || [])
          .filter((v: { eav_code: string | null }) => v.eav_code !== null)
          .map((v: { eav_code: string | null }) => v.eav_code as string)
      );

      // Map Supabase rows to domain models, then filter to only those with videos
      const mappedProjects = mapProjectRowsToProjects(projectData || []);
      const projectsWithVideosData = mappedProjects.filter((project) =>
        project.eav_code && eavCodesWithVideos.has(project.eav_code)
      );

      setProjects(projectsWithVideosData);

    } catch (err) {
      const errorMessage = `Failed to load projects: ${err}`;
      setError(errorMessage);
      Logger.error('Navigation: Load projects error', { error: (err as Error).message });
    }

    if (isRefresh) {
      setIsRefreshing(false);
    } else {
      setLoading(false);
    }
  }, []);

  // ========== DATA FETCHING - VIDEOS ==========
  // Extracted from Lines 155-244
  const loadVideos = useCallback(async (projectId: string, isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    setError(null);

    try {
      // SECURITY: Validate projectId before database operation
      const validatedProjectId = validateProjectId(projectId);

      // Find project's eav_code from current projects ref (avoid stale closure)
      let project = projectsRef.current.find(p => p.id === validatedProjectId);

      // If project not found, fetch it from database
      if (!project) {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', validatedProjectId)
          .single();

        if (projectError || !projectData) {
          Logger.error(`Failed to fetch project ${validatedProjectId}`, {
            error: projectError ? (projectError as Error).message : 'No data'
          });
          if (!isRefresh) {
            setLoading(false);
          }
          return;
        }

        // Update local projects state if not refresh
        if (!isRefresh) {
          setProjects(prevProjects => {
            const mappedProject = mapProjectRowToProject(projectData);
            const exists = prevProjects.some(p => p.id === mappedProject.id);
            if (!exists) {
              return [...prevProjects, mappedProject];
            }
            return prevProjects;
          });
        }

        project = mapProjectRowToProject(projectData);
      }

      if (!project?.eav_code) {
        if (project) {
          Logger.warn(`Project ${validatedProjectId} exists but has no eav_code, cannot load videos`, {
            project,
            isRefresh
          });
        }
        if (!isRefresh) {
          setLoading(false);
        }
        return;
      }

      // Fetch videos for this eav_code with script status (Enhancement #4)
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          scripts(status)
        `)
        .eq('eav_code', project.eav_code)
        .order('title');

      if (error) throw error;

      // Map video rows to domain models and update state - group by eav_code
      const mappedVideos = mapVideoRowsToVideos(data || []);
      setVideos(prevVideos => ({
        ...prevVideos,
        [project.eav_code]: mappedVideos
      }));

      // Track expanded project for refresh
      expandedProjectsRef.current.add(projectId);

    } catch (err) {
      if (err instanceof ValidationError) {
        setError(`Invalid project ID: ${err.message}`);
      } else {
        setError(`Failed to load videos: ${err}`);
      }
      Logger.error('Navigation: Load videos error', { error: (err as Error).message });
    }

    if (!isRefresh) {
      setLoading(false);
    }
  }, []);

  // ========== REFRESH DATA ==========
  // Extracted from Lines 57-78
  // SECURITY FIX: Prevent race condition by using functional state updates
  const refreshData = useCallback(async () => {
    // Refresh projects data without disrupting UI
    await loadProjects(true);

    // Refresh videos for currently expanded projects
    // Use ref to avoid stale closure issues
    const currentExpanded = Array.from(expandedProjectsRef.current);
    const refreshPromises = currentExpanded.map(projectId =>
      loadVideos(projectId, true)
    );

    try {
      await Promise.all(refreshPromises);
    } catch (err) {
      Logger.error('Failed to refresh expanded project videos', {
        error: (err as Error).message
      });
    }
  }, [loadProjects, loadVideos]);

  // ========== AUTO-REFRESH EFFECT ==========
  // Extracted from Lines 80-100
  useEffect(() => {
    if (!autoRefresh || !isVisible) {
      return;
    }

    // Initial load
    loadProjects();

    // Set up refresh interval
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        refreshData();
      }
    }, refreshInterval);

    // Cleanup interval on unmount or dependency change
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, isVisible, refreshInterval]); // Intentionally exclude refreshData to prevent infinite loop

  // ========== RETURN INTERFACE ==========
  return {
    // Data
    projects,
    videos,
    loading,
    error,
    isRefreshing,

    // Methods
    loadVideos,
    refreshData,
  };
}
