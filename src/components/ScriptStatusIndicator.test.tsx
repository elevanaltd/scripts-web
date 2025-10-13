/**
 * Script Status Indicator Tests
 *
 * Tests the component that shows script status information for debugging
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScriptStatusIndicator } from './ScriptStatusIndicator';

const mockScript = {
  id: 'script-123',
  video_id: 'video-456',
  content: '<p>Test script content</p>',
  components: [
    {
      number: 1,
      content: 'First component',
      wordCount: 2,
      hash: 'abc123'
    },
    {
      number: 2,
      content: 'Second component',
      wordCount: 2,
      hash: 'def456'
    }
  ],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T12:00:00Z'
};

describe('ScriptStatusIndicator', () => {
  it('should render script status when provided', () => {
    const lastSaved = new Date('2024-01-01T12:00:00Z');

    render(
      <ScriptStatusIndicator
        currentScript={mockScript}
        saveStatus="saved"
        lastSaved={lastSaved}
        componentCount={2}
      />
    );

    expect(screen.getByText('Script Status')).toBeInTheDocument();
    expect(screen.getByText('script-123')).toBeInTheDocument();
    expect(screen.getByText('2 components')).toBeInTheDocument();
  });

  it('should show no script message when no script provided', () => {
    render(
      <ScriptStatusIndicator
        currentScript={null}
        saveStatus="saved"
        lastSaved={null}
        componentCount={0}
      />
    );

    expect(screen.getByText('No script loaded')).toBeInTheDocument();
  });
});