/**
 * Generic interval hook with auto-cleanup on unmount.
 *
 * Calls `callback` every `delayMs` milliseconds.
 * Pass null for delay to pause the interval.
 */

import { useEffect, useRef } from 'react';

export function useInterval(callback: () => void, delayMs: number | null): void {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delayMs === null) return;

    const tick = () => savedCallback.current();
    const id = setInterval(tick, delayMs);

    return () => clearInterval(id);
  }, [delayMs]);
}
