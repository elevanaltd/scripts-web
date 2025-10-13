/**
 * Script Status Context Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ScriptStatusProvider, useScriptStatus } from './ScriptStatusContext';

// Test component to access the context
function TestComponent() {
  const { scriptStatus, updateScriptStatus, clearScriptStatus } = useScriptStatus();

  return (
    <div>
      <div data-testid="status">
        {scriptStatus ? JSON.stringify(scriptStatus) : 'null'}
      </div>
      <button
        onClick={() => updateScriptStatus({
          saveStatus: 'saved',
          lastSaved: new Date('2024-01-01T12:00:00Z'),
          componentCount: 3
        })}
      >
        Update Status
      </button>
      <button onClick={() => updateScriptStatus({ saveStatus: 'saving' })}>
        Update Save Status
      </button>
      <button onClick={clearScriptStatus}>
        Clear Status
      </button>
    </div>
  );
}

describe('ScriptStatusContext', () => {
  it('should provide initial null status', () => {
    render(
      <ScriptStatusProvider>
        <TestComponent />
      </ScriptStatusProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('null');
  });

  it('should update script status', () => {
    render(
      <ScriptStatusProvider>
        <TestComponent />
      </ScriptStatusProvider>
    );

    act(() => {
      screen.getByText('Update Status').click();
    });

    const statusElement = screen.getByTestId('status');
    const statusData = JSON.parse(statusElement.textContent || '{}');

    expect(statusData.saveStatus).toBe('saved');
    expect(statusData.componentCount).toBe(3);
    expect(statusData.lastSaved).toBe('2024-01-01T12:00:00.000Z');
  });

  it('should partially update script status', () => {
    render(
      <ScriptStatusProvider>
        <TestComponent />
      </ScriptStatusProvider>
    );

    // First set a full status
    act(() => {
      screen.getByText('Update Status').click();
    });

    // Then partially update
    act(() => {
      screen.getByText('Update Save Status').click();
    });

    const statusElement = screen.getByTestId('status');
    const statusData = JSON.parse(statusElement.textContent || '{}');

    expect(statusData.saveStatus).toBe('saving');
    expect(statusData.componentCount).toBe(3); // Should remain unchanged
  });

  it('should clear script status', () => {
    render(
      <ScriptStatusProvider>
        <TestComponent />
      </ScriptStatusProvider>
    );

    // Set status
    act(() => {
      screen.getByText('Update Status').click();
    });

    // Clear status
    act(() => {
      screen.getByText('Clear Status').click();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('null');
  });

  it('should throw error when used outside provider', () => {
    // Mock console.error to avoid noise in tests
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useScriptStatus must be used within a ScriptStatusProvider');

    consoleSpy.mockRestore();
  });
});