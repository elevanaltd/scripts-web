/**
 * Desktop Required Fallback
 *
 * Professional mobile user experience that clearly communicates
 * desktop requirements without broken layouts or maintenance overhead.
 *
 * Critical-Engineer: consulted for Professional mobile fallback patterns
 */

import React from 'react'
import './DesktopRequired.css'

export const DesktopRequired: React.FC = () => {
  return (
    <div className="desktop-required">
      <div className="desktop-required-container">
        <div className="desktop-required-icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>

        <div className="desktop-required-content">
          <h1 className="desktop-required-title">
            Desktop Required
          </h1>

          <p className="desktop-required-description">
            EAV Orchestrator is designed for video production workflows that require
            precision editing, multiple tabs, and collaborative features best
            experienced on desktop and laptop computers.
          </p>

          <div className="desktop-required-features">
            <h2>Why Desktop?</h2>
            <ul>
              <li>
                <strong>Rich Text Editing:</strong> Advanced paragraph-component editing with TipTap
              </li>
              <li>
                <strong>Multi-Tab Workflow:</strong> Script → Review → Scenes → Voice → Edit phases
              </li>
              <li>
                <strong>Collaborative Comments:</strong> Google Docs-like review system
              </li>
              <li>
                <strong>Professional Tools:</strong> Optimized for video production teams
              </li>
            </ul>
          </div>

          <div className="desktop-required-instructions">
            <h2>Access Options</h2>
            <div className="access-options">
              <div className="access-option">
                <h3>🖥️ Desktop Computer</h3>
                <p>Full feature access with optimal performance</p>
              </div>
              <div className="access-option">
                <h3>💻 Laptop</h3>
                <p>Complete workflow support with portable convenience</p>
              </div>
              <div className="access-option">
                <h3>📱 Mobile (Limited)</h3>
                <p>View-only access for reviewing scripts and comments</p>
                <small>Feature in development</small>
              </div>
            </div>
          </div>

          <div className="desktop-required-footer">
            <p>
              Thank you for choosing EAV Orchestrator for your video production workflow.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}