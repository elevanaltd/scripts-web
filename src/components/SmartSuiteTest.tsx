import { useState } from 'react';
import { smartSuiteData } from '../lib/smartsuite-data';
import type { Tables } from '../types/database.types';

export const SmartSuiteTest = () => {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Tables<'projects'>[]>([]);

  const testConnection = async () => {
    setLoading(true);
    setStatus('Fetching projects from Supabase...');

    try {
      // Fetch projects from Supabase (already synced via webhooks)
      setStatus('📋 Fetching projects...');
      const projectData = await smartSuiteData.fetchProjects();

      if (projectData.length > 0) {
        setProjects(projectData);
        setStatus(`✅ Found ${projectData.length} projects`);


        // Check sync status
        const syncStatus = await smartSuiteData.getSyncStatus();
        if (syncStatus.lastSync) {
          const syncDate = new Date(syncStatus.lastSync);
          setStatus(prev => prev + `\n⏰ Last sync: ${syncDate.toLocaleString()}`);
        }
      } else {
        setStatus('⚠️ No projects found. Run manual sync or wait for webhooks.');
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('SmartSuite test error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      margin: '20px'
    }}>
      <h3>SmartSuite Integration Test</h3>

      <button
        onClick={testConnection}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: loading ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Testing...' : 'Test SmartSuite Connection'}
      </button>

      {status && (
        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: 'white',
          borderRadius: '4px',
          whiteSpace: 'pre-line',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          {status}
        </div>
      )}

      {projects.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h4>First 5 Projects:</h4>
          <ul>
            {projects.slice(0, 5).map(project => (
              <li key={project.id}>
                {project.title || project.eav_code || project.id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};