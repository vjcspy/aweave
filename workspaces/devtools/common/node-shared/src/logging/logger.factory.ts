import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import pino from 'pino';

const DEFAULT_LOG_DIR = join(homedir(), '.aweave', 'logs');

export interface CreateLoggerOptions {
  /**
   * App/service name — used as log file prefix.
   * Examples: 'server', 'cli', 'mcp-memory'
   * Default: 'app'
   */
  name?: string;

  /**
   * Value for the `service` field in structured log entries.
   * Default: same as `name`.
   * Use to maintain backward compat (e.g., 'aweave-server' for server logs
   * while `name` is 'server' for file naming).
   */
  service?: string;

  /** Log file extension. Default: '.jsonl' */
  fileExtension?: string;

  /** Log directory. Default: ~/.aweave/logs */
  logDir?: string;

  /**
   * Minimum log level.
   * Default: 'debug' when NODE_ENV !== 'production', 'info' otherwise.
   * Override with LOG_LEVEL env var.
   */
  level?: pino.Level;

  /**
   * Enable console output on stderr.
   * Uses pino-pretty in dev, raw JSON in production.
   * Default: true.
   * Set false for CLI commands (stdout is for structured output)
   * or other contexts where console noise is unwanted.
   * Can be overridden with LOG_CONSOLE=true|false env var.
   */
  console?: boolean;

  /**
   * Use synchronous file writes for the file destinations.
   * Required for short-lived processes (CLI commands) where pino's async
   * worker thread transport may not flush before process exit.
   * Default: false (async worker threads, better throughput for long-running services).
   * Set true in CLI/MCP contexts where pino.destination() sync mode is needed.
   */
  sync?: boolean;
}

/**
 * Create a shared pino logger with:
 *  - File output: all-levels JSONL + error-only JSONL with daily rotation via pino-roll
 *    (long-running services: async worker thread; CLI: sync pino.destination())
 *  - Console output on stderr — NEVER stdout (MCP stdio and CLI JSON output safety)
 *  - pino-pretty in dev, raw JSON in prod for the console target
 *
 * **CLI usage:** always call with `sync: true` to avoid async worker thread teardown
 * losing log entries when the process exits quickly.
 */
export function createLogger(options: CreateLoggerOptions = {}): pino.Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  const name = options.name ?? 'app';
  const serviceName = options.service ?? name;
  const ext = options.fileExtension ?? '.jsonl';
  const logDir = options.logDir ?? process.env.LOG_DIR ?? DEFAULT_LOG_DIR;
  const defaultLevel: pino.Level = isDev ? 'debug' : 'info';
  const level =
    (process.env.LOG_LEVEL as pino.Level | undefined) ??
    options.level ??
    defaultLevel;
  const useSyncFiles = options.sync ?? false;

  // Resolve LOG_CONSOLE: env var takes precedence over option
  let consoleEnabled = options.console !== false; // default true
  if (process.env.LOG_CONSOLE === 'false') consoleEnabled = false;
  if (process.env.LOG_CONSOLE === 'true') consoleEnabled = true;

  // Ensure log directory exists before registering transports
  mkdirSync(logDir, { recursive: true });

  const allLogsFile = join(logDir, `${name}${ext}`);
  const errorLogsFile = join(logDir, `${name}.error${ext}`);

  if (useSyncFiles) {
    // Sync mode: use pino.multistream() with pino.destination() for guaranteed writes
    // on short-lived CLI processes (no worker thread teardown race).
    const streams: pino.StreamEntry[] = [
      {
        level: 'trace' as pino.Level,
        stream: pino.destination({
          dest: allLogsFile,
          sync: true,
          mkdir: true,
        }),
      },
      {
        level: 'error' as pino.Level,
        stream: pino.destination({
          dest: errorLogsFile,
          sync: true,
          mkdir: true,
        }),
      },
    ];

    if (consoleEnabled) {
      // stderr (fd 2) — never stdout
      streams.push({
        level,
        stream: pino.destination({ dest: 2, sync: false }),
      });
    }

    return pino(
      {
        level: 'trace',
        base: { service: serviceName },
      },
      pino.multistream(streams),
    );
  }

  // Async mode: use pino.transport() with pino-roll for date-based rotation.
  // Suitable for long-running processes (NestJS server) where worker threads live
  // long enough to flush all log entries.
  const targets: pino.TransportTargetOptions[] = [
    // Target 1: All levels → rotating JSONL file (current file keeps canonical name)
    {
      target: 'pino-roll',
      level: 'trace',
      options: {
        file: allLogsFile,
        frequency: 'daily',
        mkdir: true,
      },
    },
    // Target 2: Error-only → separate rotating JSONL file
    {
      target: 'pino-roll',
      level: 'error',
      options: {
        file: errorLogsFile,
        frequency: 'daily',
        mkdir: true,
      },
    },
  ];

  // Target 3: Console on stderr (fd 2) — never stdout
  if (consoleEnabled) {
    if (isDev) {
      targets.push({
        target: 'pino-pretty',
        level,
        options: {
          destination: 2, // stderr — NEVER stdout (MCP stdio / CLI JSON output safety)
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      });
    } else {
      targets.push({
        target: 'pino/file',
        level,
        options: {
          destination: 2, // stderr
        },
      });
    }
  }

  return pino(
    {
      level: 'trace', // Let each transport enforce its own minimum level
      base: { service: serviceName },
    },
    pino.transport({ targets }),
  );
}
