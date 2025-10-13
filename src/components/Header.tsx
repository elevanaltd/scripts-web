import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useScriptStatus } from '../contexts/ScriptStatusContext'
import '../styles/Header.css'

export function Header() {
  const { currentUser, userProfile, logout } = useAuth()
  const { scriptStatus } = useScriptStatus()

  const handleLogout = () => {
    logout()
  }

  const formatSaveTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'saved': return '#10b981';
      case 'saving': return '#f59e0b';
      case 'unsaved': return '#6b7280';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">EAV Orchestrator</h1>
        </div>
        <div className="header-center">
          {scriptStatus && (
            <div className="script-status">
              <span
                className="status-badge"
                style={{
                  backgroundColor: getStatusColor(scriptStatus.saveStatus),
                  color: 'white'
                }}
              >
                {scriptStatus.saveStatus}
              </span>
              <span className="component-count">
                {scriptStatus.componentCount} components
              </span>
              {scriptStatus.lastSaved && (
                <span className="last-saved">
                  {formatSaveTime(scriptStatus.lastSaved)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="header-right">
          {currentUser && (
            <div className="user-controls">
              <span className="user-email">
                {currentUser.email}
                {userProfile && (
                  <span style={{ marginLeft: '8px', opacity: 0.7, fontSize: '0.9em' }}>
                    ({userProfile.role || 'no role'})
                  </span>
                )}
              </span>
              <button
                className="logout-button"
                onClick={handleLogout}
                type="button"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}