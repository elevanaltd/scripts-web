import { createContext, useContext, useState, ReactNode } from 'react';

interface Project {
  id: string;
  title: string;
  eav_code: string;
  due_date?: string;
  project_phase?: string | null;
}

interface Video {
  id: string;
  eav_code: string;
  title: string;
  main_stream_status?: string;
  vo_stream_status?: string;
}

interface NavigationContextType {
  // Selection state
  selectedProject: Project | null;
  selectedVideo: Video | null;

  // Selection actions
  setSelectedProject: (project: Project | null) => void;
  setSelectedVideo: (video: Video | null, project?: Project | null) => void;

  // Helpers
  clearSelection: () => void;
  isProjectSelected: (projectId: string) => boolean;
  isVideoSelected: (videoId: string) => boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const handleSetSelectedProject = (project: Project | null) => {
    setSelectedProject(project);
    // Clear video selection when switching projects (unless it's the same project's eav_code)
    if (selectedVideo && project?.eav_code !== selectedVideo.eav_code) {
      setSelectedVideo(null);
    }
  };

  const handleSetSelectedVideo = (video: Video | null, project?: Project | null) => {
    setSelectedVideo(video);
    // Automatically set the project if video is provided and project is not already set
    if (video && project && selectedProject?.id !== project.id) {
      setSelectedProject(project);
    }
  };

  const clearSelection = () => {
    setSelectedProject(null);
    setSelectedVideo(null);
  };

  const isProjectSelected = (projectId: string): boolean => {
    return selectedProject?.id === projectId;
  };

  const isVideoSelected = (videoId: string): boolean => {
    return selectedVideo?.id === videoId;
  };

  const value: NavigationContextType = {
    selectedProject,
    selectedVideo,
    setSelectedProject: handleSetSelectedProject,
    setSelectedVideo: handleSetSelectedVideo,
    clearSelection,
    isProjectSelected,
    isVideoSelected,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

export type { Project, Video, NavigationContextType };