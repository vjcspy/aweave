/**
 * @hod/aweave-cli-shared — Shared utilities for the aw CLI ecosystem.
 *
 * This package provides:
 * - MCP response format models (MCPResponse, MCPContent, MCPError)
 * - HTTP client with error handling
 * - CLI output and content reading helpers
 * - pm2 service management utilities
 * - Shared pino logger (getCliLogger)
 *
 * Both the main CLI (@hod/aweave) and all plugins (@hod/aweave-plugin-*)
 * depend on this package. It has NO CLI framework dependency (no oclif, no commander).
 */

// Shared CLI logger
export { getCliLogger } from './logger';

// Logger factory — for plugins that need package-specific log file names
export {
  createLogger,
  type CreateLoggerOptions,
} from '@hod/aweave-node-shared';

// MCP response format
export {
  ContentType,
  MCPContent,
  type MCPContentData,
  MCPError,
  type MCPErrorData,
  MCPResponse,
  type MCPResponseData,
} from './mcp';
export { createPaginatedResponse } from './mcp';

// HTTP client
export { HTTPClient, HTTPClientError, type HTTPClientOptions } from './http';

// CLI helpers
export { errorResponse, handleServerError, output } from './helpers';
export { type ContentInput, type ContentResult, readContent } from './helpers';

// pm2 service management (legacy — will be removed)
export {
  checkHealth,
  checkPm2Process,
  runCommand,
  startPm2,
  stopPm2,
  waitForHealthy,
} from './services';

// Server process manager (replaces PM2)
export {
  ensureServerRunning,
  getServerStatus,
  resolveServerEntry,
  restartServer,
  type ServerState,
  type ServerStatus,
  startServer,
  stopServer,
} from './services';

// TCP Forwarder manager
export {
  FORWARDER_DEFAULTS,
  type ForwarderState,
  type ForwarderStatusCode,
  type ForwarderStatusResult,
  getForwarderStatus,
  killForwarder,
  listForwarders,
  startForwarder,
  stopForwarder,
} from './services';
