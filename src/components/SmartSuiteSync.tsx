import React, { useState, useEffect } from 'react'
import { smartSuite, SyncStatus, ComponentData } from '../lib/smartsuite'

interface SmartSuiteSyncProps {
  editorContent: string;
  onSync?: (status: SyncStatus) => void;
}

export const SmartSuiteSync: React.FC<SmartSuiteSyncProps> = ({ editorContent, onSync }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [components, setComponents] = useState<ComponentData[]>([]);

  useEffect(() => {
    // Load initial sync status
    const loadStatus = async () => {
      const status = await smartSuite.getSyncStatus();
      setSyncStatus(status);
    };
    loadStatus();
  }, []);

  useEffect(() => {
    // Extract components when content changes
    if (editorContent) {
      const extracted = smartSuite.extractComponentsFromContent(editorContent);
      setComponents(extracted);
    }
  }, [editorContent]);

  const handleSync = async () => {
    setIsLoading(true);
    try {
      const status = await smartSuite.syncComponents(components);
      setSyncStatus(status);
      onSync?.(status);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    const isConnected = await smartSuite.testConnection();
    setSyncStatus(prev => prev ? { ...prev, isConnected } : {
      isConnected,
      lastSync: null,
      pendingChanges: 0,
      error: null
    });
    setIsLoading(false);
  };

  return (
    <div className="smartsuite-sync">
      <div className="sync-header">
        <h3>SmartSuite Integration</h3>
        <div className="workspace-info">
          <span className="workspace-id">Workspace: s3qnmox1</span>
          <span className="table-id">Table: 68b2437a8f1755b055e0a124</span>
        </div>
      </div>

      <div className="sync-status">
        {syncStatus && (
          <>
            <div className={`connection-status ${syncStatus.isConnected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              {syncStatus.isConnected ? 'Connected' : 'Disconnected'}
            </div>

            <div className="sync-info">
              <div>Last Sync: {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}</div>
              <div>Pending Changes: {syncStatus.pendingChanges}</div>
              {syncStatus.error && <div className="error">Error: {syncStatus.error}</div>}
            </div>
          </>
        )}
      </div>

      <div className="components-preview">
        <h4>Extracted Components ({components.length})</h4>
        {components.map((component) => (
          <div key={component.componentId} className="component-preview">
            <strong>{component.componentId}:</strong> {component.content.substring(0, 100)}...
          </div>
        ))}
      </div>

      <div className="sync-actions">
        <button
          onClick={handleTestConnection}
          disabled={isLoading}
          className="test-connection-btn"
        >
          {isLoading ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={handleSync}
          disabled={isLoading || components.length === 0}
          className="sync-btn"
        >
          {isLoading ? 'Syncing...' : `Sync ${components.length} Components`}
        </button>
      </div>

      <div className="prototype-note">
        <strong>Prototype Mode:</strong> Manual sync with visual feedback. Production version will include automatic sync and real-time status updates.
      </div>
    </div>
  );
};