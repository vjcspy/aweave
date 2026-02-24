/**
 * Hook: Live server log stream from ~/.aweave/logs/server.jsonl.
 *
 * Uses file tailing (polling + incremental reads) for real-time streaming.
 * Maintains bounded rolling buffer (last N lines).
 * Parses JSONL (Pino) when possible and falls back to raw lines.
 */

import { useEffect, useRef, useState } from 'react';

import {
  createFileTailStream,
  getDefaultServerJsonlPath,
} from '../lib/file-tail.js';

const DEFAULT_MAX_LINES = 100;
const DEFAULT_SERVICE = 'aweave-server';

export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'unknown';

export interface LogsData {
  lines: LogLine[];
  streaming: boolean;
  error?: string;
  sourcePath: string;
}

export interface LogLine {
  lineId: number;
  timestamp: Date;
  service: string;
  message: string;
  level: LogLevel;
  raw: string;
  context?: string;
  correlationId?: string;
  parsed?: Record<string, unknown>;
}

export function useLogs(
  serviceName?: string,
  maxLines: number = DEFAULT_MAX_LINES,
): LogsData {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const sourcePath = getDefaultServerJsonlPath();
  const streamRef = useRef<ReturnType<typeof createFileTailStream> | null>(
    null,
  );
  const lineIdRef = useRef(0);

  useEffect(() => {
    setLines([]);
    setError(undefined);
    setStreaming(false);
    lineIdRef.current = 0;

    const stream = createFileTailStream({
      filePath: sourcePath,
      initialLines: maxLines,
    });
    streamRef.current = stream;
    setStreaming(true);

    const onLine = (rawLine: string) => {
      const parsedLine = parseLogLine(rawLine, ++lineIdRef.current);

      if (serviceName && parsedLine.service !== serviceName) {
        return;
      }

      setLines((prev) => {
        const updated = [...prev, parsedLine];
        return updated.length > maxLines ? updated.slice(-maxLines) : updated;
      });
    };

    const onError = (streamError: Error) => {
      setError(streamError.message || 'Server log stream not available');
    };

    const onClose = () => {
      setStreaming(false);
    };

    stream.emitter.on('line', onLine);
    stream.emitter.on('error', onError);
    stream.emitter.on('close', onClose);

    return () => {
      stream.emitter.off('line', onLine);
      stream.emitter.off('error', onError);
      stream.emitter.off('close', onClose);
      stream.stop();
      streamRef.current = null;
    };
  }, [maxLines, serviceName, sourcePath]);

  return { lines, streaming, error, sourcePath };
}

function parseLogLine(rawLine: string, lineId: number): LogLine {
  const fallbackTimestamp = new Date();
  const parsed = tryParseJsonRecord(rawLine);

  if (!parsed) {
    return {
      lineId,
      timestamp: fallbackTimestamp,
      service: DEFAULT_SERVICE,
      message: rawLine,
      level: inferLevelFromText(rawLine),
      raw: rawLine,
    };
  }

  return {
    lineId,
    timestamp: parseTimestamp(parsed.time) ?? fallbackTimestamp,
    service:
      typeof parsed.service === 'string' ? parsed.service : DEFAULT_SERVICE,
    message: pickMessage(parsed, rawLine),
    level: normalizeLogLevel(parsed.level, rawLine),
    raw: rawLine,
    context: typeof parsed.context === 'string' ? parsed.context : undefined,
    correlationId:
      typeof parsed.correlationId === 'string'
        ? parsed.correlationId
        : undefined,
    parsed,
  };
}

function tryParseJsonRecord(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function pickMessage(parsed: Record<string, unknown>, rawLine: string): string {
  if (typeof parsed.msg === 'string') return parsed.msg;
  if (typeof parsed.message === 'string') return parsed.message;
  return rawLine;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function normalizeLogLevel(value: unknown, rawLine: string): LogLevel {
  if (typeof value === 'number') {
    if (value >= 60) return 'fatal';
    if (value >= 50) return 'error';
    if (value >= 40) return 'warn';
    if (value >= 30) return 'info';
    if (value >= 20) return 'debug';
    if (value >= 10) return 'trace';
    return 'unknown';
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (
      normalized === 'trace' ||
      normalized === 'debug' ||
      normalized === 'info' ||
      normalized === 'warn' ||
      normalized === 'error' ||
      normalized === 'fatal'
    ) {
      return normalized;
    }
  }

  return inferLevelFromText(rawLine);
}

function inferLevelFromText(message: string): LogLevel {
  const upper = message.toUpperCase();
  if (upper.includes('FATAL')) return 'fatal';
  if (upper.includes('ERROR') || upper.includes('ERR')) return 'error';
  if (upper.includes('WARN')) return 'warn';
  if (upper.includes('INFO')) return 'info';
  if (upper.includes('DEBUG')) return 'debug';
  if (upper.includes('TRACE')) return 'trace';
  return 'unknown';
}
