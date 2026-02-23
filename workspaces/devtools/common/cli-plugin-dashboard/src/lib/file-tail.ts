import { EventEmitter } from 'node:events';
import { open, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_LOG_DIR = join(homedir(), '.aweave', 'logs');
const DEFAULT_SERVER_JSONL_FILE = 'server.jsonl';
const DEFAULT_POLL_INTERVAL_MS = 500;
const READ_CHUNK_SIZE = 64 * 1024;

export interface CreateFileTailStreamOptions {
  filePath?: string;
  initialLines?: number;
  pollIntervalMs?: number;
}

export interface FileTailStream {
  emitter: EventEmitter;
  filePath: string;
  stop: () => void;
}

export function getDefaultServerJsonlPath(): string {
  const logDir = process.env.LOG_DIR ?? DEFAULT_LOG_DIR;
  return join(logDir, DEFAULT_SERVER_JSONL_FILE);
}

export async function readLastLines(
  filePath: string,
  maxLines: number,
): Promise<string[]> {
  if (maxLines <= 0) return [];

  try {
    const content = await readFile(filePath, 'utf8');
    return splitLines(content).slice(-maxLines);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return [];
    }

    throw error;
  }
}

export function createFileTailStream({
  filePath = getDefaultServerJsonlPath(),
  initialLines = 0,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: CreateFileTailStreamOptions = {}): FileTailStream {
  const emitter = new EventEmitter();

  let stopped = false;
  let pollTimer: NodeJS.Timeout | null = null;
  let readPosition = 0;
  let pendingRemainder = '';
  let isPolling = false;

  const emitError = (error: unknown) => {
    if (stopped) return;
    emitter.emit(
      'error',
      error instanceof Error ? error : new Error(String(error)),
    );
  };

  const emitCompleteLines = (chunk: string) => {
    if (!chunk) return;

    pendingRemainder += chunk;
    const parts = pendingRemainder.split(/\r?\n/);
    pendingRemainder = parts.pop() ?? '';

    for (const line of parts) {
      if (line.length > 0) {
        emitter.emit('line', line);
      }
    }
  };

  const initialize = async () => {
    try {
      if (initialLines > 0) {
        const initial = await readLastLines(filePath, initialLines);
        for (const line of initial) {
          emitter.emit('line', line);
        }

        try {
          const content = await readFile(filePath, 'utf8');
          readPosition = Buffer.byteLength(content, 'utf8');
        } catch (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
          ) {
            readPosition = 0;
          } else {
            throw error;
          }
        }
      } else {
        try {
          const fileStat = await stat(filePath);
          readPosition = fileStat.size;
        } catch (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
          ) {
            readPosition = 0;
          } else {
            throw error;
          }
        }
      }

      emitter.emit('ready');
    } catch (error) {
      emitError(error);
    }
  };

  const poll = async () => {
    if (stopped || isPolling) return;
    isPolling = true;

    try {
      let fileStat;
      try {
        fileStat = await stat(filePath);
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          // File not created yet (or temporarily absent after rotation).
          isPolling = false;
          return;
        }

        throw error;
      }

      if (fileStat.size < readPosition) {
        // File was truncated/rotated. Restart from beginning.
        readPosition = 0;
        pendingRemainder = '';
        emitter.emit('reset');
      }

      if (fileStat.size === readPosition) {
        isPolling = false;
        return;
      }

      const handle = await open(filePath, 'r');
      try {
        let offset = readPosition;
        let remaining = fileStat.size - readPosition;

        while (remaining > 0 && !stopped) {
          const chunkSize = Math.min(remaining, READ_CHUNK_SIZE);
          const buffer = Buffer.alloc(chunkSize);
          const { bytesRead } = await handle.read(buffer, 0, chunkSize, offset);

          if (bytesRead <= 0) break;

          emitCompleteLines(buffer.toString('utf8', 0, bytesRead));

          offset += bytesRead;
          remaining -= bytesRead;
        }

        readPosition = offset;
      } finally {
        await handle.close();
      }
    } catch (error) {
      emitError(error);
    } finally {
      isPolling = false;
    }
  };

  void (async () => {
    await initialize();
    if (stopped) return;

    pollTimer = setInterval(
      () => {
        void poll();
      },
      Math.max(100, pollIntervalMs),
    );

    // Trigger an immediate read to capture writes that happened after initialization.
    void poll();
  })();

  return {
    emitter,
    filePath,
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      emitter.emit('close');
    },
  };
}

function splitLines(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines.at(-1) === '') {
    lines.pop();
  }

  return lines.filter((line) => line.length > 0);
}
