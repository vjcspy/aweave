import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import pino from 'pino';

const DEFAULT_LOG_DIR = join(homedir(), '.aweave', 'logs');
const DEFAULT_LOG_FILE = 'server.jsonl';

/**
 * Create the shared pino logger instance with dual transport:
 * - File: JSONL to ~/.aweave/logs/server.jsonl (always enabled)
 * - Console: pino-pretty in dev, raw JSON otherwise
 */
export function createLogger(): pino.Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  const defaultLevel = isDev ? 'debug' : 'info';
  const level = process.env.LOG_LEVEL ?? defaultLevel;

  const logDir = process.env.LOG_DIR ?? DEFAULT_LOG_DIR;
  const logFile = join(logDir, DEFAULT_LOG_FILE);

  // Ensure log directory exists
  mkdirSync(logDir, { recursive: true });

  const targets: pino.TransportTargetOptions[] = [
    // Always write JSONL to file
    {
      target: 'pino/file',
      level: 'trace',
      options: { destination: logFile, mkdir: true },
    },
  ];

  if (isDev) {
    // Pretty-print to stdout in development
    targets.push({
      target: 'pino-pretty',
      level,
      options: {
        destination: 1, // stdout
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    });
  } else {
    // Raw JSON to stdout in production
    targets.push({
      target: 'pino/file',
      level,
      options: { destination: 1 },
    });
  }

  return pino(
    {
      level: 'trace', // Set to trace so transports control their own levels
      base: { service: 'aweave-server' },
    },
    pino.transport({ targets }),
  );
}
