import { useCallback, useRef } from 'react';
import type { CommentHighlight } from '../components/extensions/CommentPositionTracker';

/**
 * Hook for debounced comment position synchronization
 *
 * Prevents race conditions with database updates by debouncing
 * rapid position changes during editing.
 *
 * @param options - Configuration options
 * @param options.onUpdate - Callback to sync positions (e.g., to database)
 * @param options.debounceMs - Debounce delay in milliseconds (default: 500ms)
 * @returns Object with debouncedUpdate function
 */
export function useCommentPositionSync(options: {
  onUpdate?: (highlights: CommentHighlight[]) => Promise<void>;
  debounceMs?: number;
} = {}) {
  const { onUpdate, debounceMs = 500 } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedUpdate = useCallback(
    async (highlights: CommentHighlight[]) => {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Skip empty updates
      if (highlights.length === 0) {
        return;
      }

      // Debounce the update
      timeoutRef.current = setTimeout(async () => {
        if (onUpdate) {
          await onUpdate(highlights);
        }
      }, debounceMs);
    },
    [onUpdate, debounceMs]
  );

  return { debouncedUpdate };
}
