/**
 * Script Status Indicator - Development Helper Component
 *
 * Shows current script status information for testing and validation
 * This component helps verify that script loading/saving operations are working correctly
 */

import React from 'react';
import { Script } from '../services/scriptService';

interface ScriptStatusIndicatorProps {
  currentScript: Script | null;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  lastSaved: Date | null;
  componentCount: number;
}

export const ScriptStatusIndicator: React.FC<ScriptStatusIndicatorProps> = ({
  currentScript,
  saveStatus,
  lastSaved,
  componentCount
}) => {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'saved': return '#10B981';
      case 'saving': return '#F59E0B';
      case 'unsaved': return '#F59E0B';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <div className="script-status-indicator">
      <style>{`
        .script-status-indicator {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: white;
          border: 2px solid #e5e5e5;
          border-radius: 8px;
          padding: 16px;
          width: 280px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 13px;
          z-index: 1000;
        }

        .status-header {
          font-weight: 600;
          margin-bottom: 12px;
          color: #1a1a1a;
          font-size: 14px;
          border-bottom: 1px solid #e5e5e5;
          padding-bottom: 8px;
        }

        .status-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          align-items: center;
        }

        .status-label {
          color: #666;
          font-weight: 500;
        }

        .status-value {
          color: #1a1a1a;
          font-weight: 600;
        }

        .status-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          background: #f3f4f6;
          color: #374151;
        }

        .script-id {
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 11px;
          color: #6b7280;
          background: #f8f9fa;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .no-script {
          color: #9ca3af;
          font-style: italic;
          text-align: center;
          padding: 20px 0;
        }
      `}</style>

      <div className="status-header">Script Status</div>

      {currentScript ? (
        <>
          <div className="status-row">
            <span className="status-label">Script ID:</span>
            <span className="script-id">{currentScript.id}</span>
          </div>

          <div className="status-row">
            <span className="status-label">Components:</span>
            <span className="status-value">{componentCount} components</span>
          </div>

          <div className="status-row">
            <span className="status-label">Save Status:</span>
            <span
              className="status-badge"
              style={{
                background: getStatusColor(saveStatus),
                color: 'white'
              }}
            >
              {saveStatus}
            </span>
          </div>

          {lastSaved && (
            <div className="status-row">
              <span className="status-label">Last Saved:</span>
              <span className="status-value">{formatTime(lastSaved)}</span>
            </div>
          )}

          <div className="status-row">
            <span className="status-label">Created:</span>
            <span className="status-value">
              {new Date(currentScript.created_at).toLocaleDateString()}
            </span>
          </div>
        </>
      ) : (
        <div className="no-script">No script loaded</div>
      )}
    </div>
  );
};