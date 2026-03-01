import { mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import pino from 'pino';

const DEFAULT_LOG_DIR = join(homedir(), '.aweave', 'logs');

/** Returns today's local date as 'yyyy-MM-dd' (matches pino-roll's local-time rotation). */
function getLocalDateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

  // Normalize extension: ensure dot-prefix for pino-roll (e.g. '.jsonl')
  // and bare form for sync filenames (e.g. 'jsonl')
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`;
  const bareExt = dotExt.slice(1);

  // Ensure log directory exists before registering transports
  mkdirSync(logDir, { recursive: true });

  if (useSyncFiles) {
    // Sync mode: embed today's local date into the filename at creation time.
    // Short-lived CLI processes won't span midnight — acceptable trade-off.
    const dateStamp = getLocalDateStamp();
    const syncAllFile = join(logDir, `${name}.${dateStamp}.${bareExt}`);
    const syncErrorFile = join(logDir, `${name}.error.${dateStamp}.${bareExt}`);

    const streams: pino.StreamEntry[] = [
      {
        level: 'trace' as pino.Level,
        stream: pino.destination({
          dest: syncAllFile,
          sync: true,
          mkdir: true,
        }),
      },
      {
        level: 'error' as pino.Level,
        stream: pino.destination({
          dest: syncErrorFile,
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

  // Async mode: use pino.transport() with pino-roll Extension Last Format.
  // Pass file WITHOUT extension + extension option → produces {name}.{date}.{count}.{ext}
  // Suitable for long-running processes (NestJS server) where worker threads live
  // long enough to flush all log entries.
  const targets: pino.TransportTargetOptions[] = [
    // Target 1: All levels → rotating JSONL file with date-based naming
    // pino-roll Extension Last Format: {file}.{date}.{count}.{extension}
    {
      target: 'pino-roll',
      level: 'trace',
      options: {
        file: join(logDir, name),
        frequency: 'daily',
        dateFormat: 'yyyy-MM-dd',
        extension: dotExt,
        mkdir: true,
      },
    },
    // Target 2: Error-only → separate rotating JSONL file with date-based naming
    // Use `error{dotExt}` as combined extension (e.g. '.error.jsonl') because
    // pino-roll skips `extension` if `file` already has one — and `server.error`
    // would be detected as having `.error` extension.
    {
      target: 'pino-roll',
      level: 'error',
      options: {
        file: join(logDir, name),
        frequency: 'daily',
        dateFormat: 'yyyy-MM-dd',
        extension: `.error${dotExt}`,
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
