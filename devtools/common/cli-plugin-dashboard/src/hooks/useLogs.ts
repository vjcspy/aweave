/**
 * Hook: Live pm2 log stream.
 *
 * Uses createPm2LogStream() for real-time streaming via long-lived spawn.
 * Maintains bounded rolling buffer (last N lines).
 * Cleanup spawned process on unmount via useEffect teardown.
 */

import { useEffect, useRef, useState } from 'react';

import { createPm2LogStream, type LogLine } from '../lib/pm2.js';

const DEFAULT_MAX_LINES = 100;

export interface LogsData {
  lines: LogLine[];
  streaming: boolean;
  error?: string;
}

export function useLogs(
  serviceName?: string,
  maxLines: number = DEFAULT_MAX_LINES,
): LogsData {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const streamRef = useRef<ReturnType<typeof createPm2LogStream> | null>(null);

  useEffect(() => {
    const stream = createPm2LogStream(serviceName);
    streamRef.current = stream;
    setStreaming(true);

    stream.emitter.on('line', (line: LogLine) => {
      setLines((prev) => {
        const updated = [...prev, line];
        return updated.length > maxLines
          ? updated.slice(-maxLines)
          : updated;
      });
    });

    stream.emitter.on('error', () => {
      setError('pm2 logs not available');
      setStreaming(false);
    });

    stream.emitter.on('close', () => {
      setStreaming(false);
    });

    // Cleanup: kill spawned pm2 log process
    return () => {
      stream.stop();
      streamRef.current = null;
    };
  }, [serviceName, maxLines]);

  return { lines, streaming, error };
}
