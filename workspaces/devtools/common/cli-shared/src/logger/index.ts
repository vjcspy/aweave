import { createLogger } from '@hod/aweave-node-shared';

// Use ReturnType to avoid needing pino as a devDep in cli-shared
type Logger = ReturnType<typeof createLogger>;

let _logger: Logger | null = null;

/**
 * Returns a singleton pino logger for CLI commands.
 *
 * - File-only by default: writes to ~/.aweave/logs/cli.jsonl (all levels)
 *   and ~/.aweave/logs/cli.error.jsonl (error-only), with daily rotation.
 * - Console output is OFF by default (stdout is reserved for MCP-like JSON).
 * - Override with LOG_CONSOLE=true for local debugging.
 *
 * NEVER use console.log / console.error in CLI commands — use this logger.
 */
export function getCliLogger(): Logger {
  if (!_logger) {
    // sync: true is required for short-lived CLI processes — pino's async worker
    // threads may not flush before process exit without it.
    _logger = createLogger({ name: 'cli', console: false, sync: true });
  }
  return _logger;
}
