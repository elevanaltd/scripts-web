/**
 * Error Boundary Component - Component Isolation and Graceful Error Handling
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the entire app
 *
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Logger } from '../services/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  clipboardMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      clipboardMessage: null
    };

    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error information for debugging and monitoring
    Logger.error('ErrorBoundary caught an error', { error: error.message, stack: error.stack, componentStack: errorInfo.componentStack });

    this.setState({
      error,
      errorInfo
    });

    // In production, you would send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo);
    }
  }

  reportError(error: Error, errorInfo: ErrorInfo) {
    // This would integrate with error reporting service (Sentry, Bugsnag, etc.)
    Logger.warn('Error reporting not implemented - would send to monitoring service', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  retry() {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      clipboardMessage: null
    }));
  }

  /**
   * Sanitize error message for security
   * Prevents exposure of sensitive information in error messages
   */
  sanitizeErrorMessage(error: Error): string {
    const message = error.message || 'Unknown error';

    // List of patterns that might contain sensitive information
    const sensitivePatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i,
      /sk-[a-zA-Z0-9]+/i, // API keys
      /[a-zA-Z0-9]{32,}/i, // Long random strings
      /postgres:\/\//i, // Database URLs
      /mysql:\/\//i,
      /mongodb:\/\//i
    ];

    // Check if error message contains sensitive information
    const containsSensitiveInfo = sensitivePatterns.some(pattern => pattern.test(message));

    if (containsSensitiveInfo || process.env.NODE_ENV === 'production') {
      return 'An unexpected error occurred. Please try again or report this issue if it persists.';
    }

    return message;
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback component
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error!}
            retry={this.retry}
          />
        );
      }

      // Default fallback UI
      return (
        <div
          className="error-boundary"
          style={{
            padding: '20px',
            border: '1px solid #ffcccb',
            borderRadius: '8px',
            backgroundColor: '#fff5f5',
            margin: '20px 0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <div
              style={{
                fontSize: '24px',
                marginRight: '10px',
                color: '#d32f2f'
              }}
            >
              ⚠️
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                color: '#d32f2f'
              }}
            >
              Something went wrong
            </h2>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <p style={{
              margin: 0,
              color: '#666',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {this.sanitizeErrorMessage(this.state.error!)}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={this.retry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#1565c0';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#1976d2';
              }}
            >
              Try Again
            </button>

            <span
              style={{
                fontSize: '12px',
                color: '#999',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              onClick={async () => {
                const errorDetails = {
                  message: this.state.error?.message,
                  timestamp: new Date().toISOString(),
                  userAgent: navigator.userAgent,
                  url: window.location.href
                };

                // Try to copy error details to clipboard for reporting
                if (navigator.clipboard) {
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
                    this.setState({ clipboardMessage: 'Error details have been copied to your clipboard. Please provide this information when reporting the issue.' });
                  } catch {
                    // Fallback when clipboard API fails
                    Logger.error('Error report details', { details: errorDetails });
                    this.setState({ clipboardMessage: 'Failed to copy to clipboard. Error details have been logged. Please copy them manually.' });
                  }
                } else {
                  // Fallback for browsers without clipboard API
                  Logger.error('Error report details', { details: errorDetails });
                  this.setState({ clipboardMessage: 'Clipboard not available. Error details have been logged to console. Please copy them manually.' });
                }
              }}
            >
              Report this issue
            </span>
          </div>

          {/* Show clipboard operation feedback */}
          {this.state.clipboardMessage && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: this.state.clipboardMessage.includes('Failed') || this.state.clipboardMessage.includes('not available') ? '#ffebee' : '#e8f5e8',
              border: `1px solid ${this.state.clipboardMessage.includes('Failed') || this.state.clipboardMessage.includes('not available') ? '#ffcdd2' : '#c8e6c9'}`,
              borderRadius: '4px',
              fontSize: '12px',
              color: this.state.clipboardMessage.includes('Failed') || this.state.clipboardMessage.includes('not available') ? '#d32f2f' : '#2e7d32'
            }}>
              {this.state.clipboardMessage}
            </div>
          )}

          {/* Show additional details in development mode */}
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ marginTop: '20px' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '10px'
                }}
              >
                Error Details (Development Only)
              </summary>
              <pre
                style={{
                  fontSize: '11px',
                  backgroundColor: '#f5f5f5',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  color: '#333'
                }}
              >
                {this.state.error?.stack}
                {'\n\nComponent Stack:'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}

          {this.state.retryCount > 0 && (
            <div
              style={{
                marginTop: '15px',
                fontSize: '12px',
                color: '#999'
              }}
            >
              Retry attempts: {this.state.retryCount}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};