/**
 * useCommentPositionSync Tests
 *
 * Tests for debounced callback mechanism for comment position updates.
 * Hook provides debouncing to prevent excessive DB writes during rapid edits.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCommentPositionSync } from './useCommentPositionSync';
import type { CommentHighlight } from '../components/extensions/CommentPositionTracker';

describe('useCommentPositionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce updates with 500ms default delay', async () => {
    const mockUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCommentPositionSync({ onUpdate: mockUpdate })
    );

    const highlights: CommentHighlight[] = [
      {
        commentId: 'c1',
        commentNumber: 1,
        startPosition: 10,
        endPosition: 20,
        resolved: false,
      },
    ];

    // Trigger update
    result.current.debouncedUpdate(highlights);

    // Should not call immediately
    expect(mockUpdate).not.toHaveBeenCalled();

    // Advance time by 499ms (not enough)
    vi.advanceTimersByTime(499);
    expect(mockUpdate).not.toHaveBeenCalled();

    // Advance final 1ms to reach 500ms
    vi.advanceTimersByTime(1);
    await vi.runAllTimersAsync();

    // Should have called once
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(highlights);
  });

  it('should reset debounce timer on rapid updates', async () => {
    const mockUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCommentPositionSync({ onUpdate: mockUpdate })
    );

    const highlights: CommentHighlight[] = [
      { commentId: 'c1', commentNumber: 1, startPosition: 10, endPosition: 20, resolved: false },
    ];

    // First update
    result.current.debouncedUpdate(highlights);
    vi.advanceTimersByTime(300);

    // Second update (should reset timer)
    result.current.debouncedUpdate(highlights);
    vi.advanceTimersByTime(300);

    // Third update (should reset timer again)
    result.current.debouncedUpdate(highlights);

    // Still shouldn't have called (timer keeps resetting)
    expect(mockUpdate).not.toHaveBeenCalled();

    // Advance final 500ms
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();

    // Should call only once with final data
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('should handle empty highlights array', async () => {
    const mockUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCommentPositionSync({ onUpdate: mockUpdate })
    );

    result.current.debouncedUpdate([]);

    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();

    // Should not call with empty array
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should support custom debounce delay', async () => {
    const mockUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCommentPositionSync({ onUpdate: mockUpdate, debounceMs: 1000 })
    );

    const highlights: CommentHighlight[] = [
      { commentId: 'c1', commentNumber: 1, startPosition: 10, endPosition: 20, resolved: false },
    ];

    result.current.debouncedUpdate(highlights);

    // 500ms shouldn't trigger with 1000ms delay
    vi.advanceTimersByTime(500);
    expect(mockUpdate).not.toHaveBeenCalled();

    // 1000ms should trigger
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple highlights in single update', async () => {
    const mockUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCommentPositionSync({ onUpdate: mockUpdate })
    );

    const highlights: CommentHighlight[] = [
      { commentId: 'c1', commentNumber: 1, startPosition: 10, endPosition: 20, resolved: false },
      { commentId: 'c2', commentNumber: 2, startPosition: 30, endPosition: 40, resolved: false },
      { commentId: 'c3', commentNumber: 3, startPosition: 50, endPosition: 60, resolved: true },
    ];

    result.current.debouncedUpdate(highlights);

    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(highlights);
  });

  it('should work without onUpdate callback', async () => {
    const { result } = renderHook(() => useCommentPositionSync());

    const highlights: CommentHighlight[] = [
      { commentId: 'c1', commentNumber: 1, startPosition: 10, endPosition: 20, resolved: false },
    ];

    // Should not throw
    expect(() => {
      result.current.debouncedUpdate(highlights);
      vi.advanceTimersByTime(500);
    }).not.toThrow();
  });
});
