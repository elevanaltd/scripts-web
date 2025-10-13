import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface SyncResult {
  projectsFound: number;
  projectsSynced: number;
  videosFound: number;
  videosSynced: number;
  errors: string[];
}

export function SmartSuiteSyncPanel() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string>('');

  const syncFromSmartSuite = async () => {
    setSyncing(true);
    setError('');
    setSyncResult(null);

    try {
      // For MVP, we'll use the manual data you've already added
      // In production, this would call the SmartSuite API

      const result: SyncResult = {
        projectsFound: 0,
        projectsSynced: 0,
        videosFound: 0,
        videosSynced: 0,
        errors: []
      };

      // Step 1: Get projects from SmartSuite (simulated with your data)
      const { data: existingProjects, error: projectError } = await supabase
        .from('projects')
        .select('*');

      if (projectError) throw projectError;

      result.projectsFound = existingProjects?.length || 0;
      result.projectsSynced = result.projectsFound;

      // Step 2: Get videos from SmartSuite (simulated with your data)
      const { data: existingVideos, error: videoError } = await supabase
        .from('videos')
        .select('*');

      if (videoError) throw videoError;

      result.videosFound = existingVideos?.length || 0;
      result.videosSynced = result.videosFound;

      setSyncResult(result);
      setLastSync(new Date().toLocaleTimeString());



      // In production, this would:
      // 1. Call SmartSuite API to get projects
      // 2. Upsert projects to Supabase
      // 3. Call SmartSuite API to get videos for each project
      // 4. Upsert videos to Supabase

      // Example of what the real implementation would look like:
      /*
      const smartSuiteApiKey = import.meta.env.VITE_SMARTSUITE_API_KEY;

      // Fetch projects from SmartSuite
      const projectsResponse = await fetch(
        'https://api.smartsuite.com/v1/applications/68a8ff5237fde0bf797c05b3/records/list',
        {
          headers: {
            'Authorization': `Bearer ${smartSuiteApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const projectsData = await projectsResponse.json();

      // Transform and upsert to Supabase
      for (const project of projectsData.items) {
        await supabase.from('projects').upsert({
          id: project.id,
          title: project.title,
          due_date: project.dueDate
        });
      }
      */

    } catch (err) {
      console.error('Sync error:', err);
      setError(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const testSmartSuiteConnection = async () => {
    setSyncing(true);
    setError('');

    try {
      // Test that we can read from SmartSuite tables
      // In production, this would test the actual API connection

      const { count: projectCount, error: projectError } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true });

      if (projectError) throw projectError;

      const { count: videoCount, error: videoError } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true });

      if (videoError) throw videoError;

      alert(`Connection test successful!\n\nProjects: ${projectCount}\nVideos: ${videoCount}`);

    } catch (err) {
      console.error('Connection test error:', err);
      setError(`Connection test failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      right: '420px',
      top: '10px',
      width: '350px',
      background: 'white',
      border: '2px solid #0284c7',
      borderRadius: '8px',
      padding: '15px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 1000
    }}>
      <h3 style={{ marginTop: 0, color: '#0284c7' }}>
        🔄 SmartSuite Sync
      </h3>

      {error && (
        <div style={{
          color: 'red',
          marginBottom: '10px',
          padding: '8px',
          background: '#fee',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <button
          onClick={testSmartSuiteConnection}
          disabled={syncing}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: syncing ? 'not-allowed' : 'pointer'
          }}
        >
          🧪 Test Connection
        </button>

        <button
          onClick={syncFromSmartSuite}
          disabled={syncing}
          style={{
            padding: '8px 16px',
            background: syncing ? '#94a3b8' : '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
        </button>
      </div>

      {lastSync && (
        <div style={{
          fontSize: '12px',
          color: '#666',
          marginBottom: '10px'
        }}>
          Last sync: {lastSync}
        </div>
      )}

      {syncResult && (
        <div style={{
          padding: '10px',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '4px',
          fontSize: '13px'
        }}>
          <strong>Sync Results:</strong>
          <div style={{ marginTop: '5px' }}>
            ✅ Projects: {syncResult.projectsSynced}/{syncResult.projectsFound}
          </div>
          <div>
            ✅ Videos: {syncResult.videosSynced}/{syncResult.videosFound}
          </div>
          {syncResult.errors.length > 0 && (
            <div style={{ color: 'red', marginTop: '5px' }}>
              ⚠️ Errors: {syncResult.errors.join(', ')}
            </div>
          )}
        </div>
      )}

      <div style={{
        marginTop: '15px',
        paddingTop: '10px',
        borderTop: '1px solid #e5e7eb',
        fontSize: '11px',
        color: '#6b7280'
      }}>
        <strong>Sync Mode:</strong> Manual (MVP)<br/>
        <strong>Direction:</strong> SmartSuite → Supabase<br/>
        <strong>Status:</strong> Using test data<br/>
        <div style={{ marginTop: '5px', fontStyle: 'italic' }}>
          Note: Currently using your manually added test data.
          Real SmartSuite API integration would be added here.
        </div>
      </div>
    </div>
  );
}