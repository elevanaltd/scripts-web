import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { mapProjectRowsToProjects } from '../lib/mappers/projectMapper';
import { mapVideoRowsToVideos } from '../lib/mappers/videoMapper';
import type { Project } from '../lib/mappers/projectMapper';
import type { Video } from '../lib/mappers/videoMapper';

export function TestDataPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('title');

      if (error) throw error;
      const mappedProjects = mapProjectRowsToProjects(data || []);
      setProjects(mappedProjects);

    } catch (err) {
      setError(`Failed to load projects: ${err}`);
      console.error('Load projects error:', err);
    }
    setLoading(false);
  };

  const loadVideos = async (projectId: string) => {
    setLoading(true);
    setError('');
    try {
      // Find project's eav_code
      const project = projects.find(p => p.id === projectId);
      if (!project?.eav_code) {
        throw new Error('Project not found or missing EAV code');
      }

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('eav_code', project.eav_code)
        .order('title');

      if (error) throw error;
      const mappedVideos = mapVideoRowsToVideos(data || []);
      setVideos(mappedVideos);

    } catch (err) {
      setError(`Failed to load videos: ${err}`);
      console.error('Load videos error:', err);
    }
    setLoading(false);
  };

  const handleProjectClick = (projectId: string) => {
    setSelectedProjectId(projectId);
    loadVideos(projectId);
  };

  return (
    <div style={{
      position: 'fixed',
      right: '10px',
      top: '10px',
      width: '400px',
      maxHeight: '600px',
      overflowY: 'auto',
      background: 'white',
      border: '2px solid #333',
      borderRadius: '8px',
      padding: '15px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 1000
    }}>
      <h3 style={{ marginTop: 0 }}>📊 Supabase Data Test Panel</h3>

      {error && (
        <div style={{ color: 'red', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h4>Projects ({projects.length})</h4>
        <button onClick={loadProjects} disabled={loading}>
          🔄 Refresh Projects
        </button>
        {loading && <span> Loading...</span>}

        <div style={{ marginTop: '10px' }}>
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project.id)}
              style={{
                padding: '8px',
                margin: '5px 0',
                background: selectedProjectId === project.id ? '#e0f2fe' : '#f5f5f5',
                border: selectedProjectId === project.id ? '2px solid #0284c7' : '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{project.title}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                ID: {project.id}
                {project.due_date && ` | Due: ${project.due_date}`}
              </div>
            </div>
          ))}
          {projects.length === 0 && !loading && (
            <div style={{ color: '#666', fontStyle: 'italic' }}>
              No projects found in Supabase
            </div>
          )}
        </div>
      </div>

      {selectedProjectId && (
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '10px' }}>
          <h4>Videos for Selected Project ({videos.length})</h4>
          {videos.map(video => (
            <div
              key={video.id}
              style={{
                padding: '8px',
                margin: '5px 0',
                background: '#f9f9f9',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{video.title}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                ID: {video.id}
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                Main: {video.main_stream_status || 'N/A'} |
                VO: {video.vo_stream_status || 'N/A'}
              </div>
            </div>
          ))}
          {videos.length === 0 && !loading && (
            <div style={{ color: '#666', fontStyle: 'italic' }}>
              No videos found for this project
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '20px',
        paddingTop: '10px',
        borderTop: '1px solid #ddd',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>Status:</strong> Connected to Supabase<br/>
        <strong>Table:</strong> projects, videos<br/>
        <strong>Click a project</strong> to load its videos
      </div>
    </div>
  );
}