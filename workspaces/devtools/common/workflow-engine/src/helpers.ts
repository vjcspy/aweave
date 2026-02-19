/**
 * Utility functions for the workflow engine.
 */

/**
 * Sleep for a given number of milliseconds.
 * Respects AbortSignal for cancellation.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Sleep aborted'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Sleep aborted'));
      },
      { once: true },
    );
  });
}

/**
 * Wrap a promise with a timeout. Rejects with TimeoutError if the promise
 * doesn't resolve within the given duration.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(ms));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Task timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Format milliseconds as human-readable duration (e.g., "1m 23s", "45s", "1.2s").
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}
