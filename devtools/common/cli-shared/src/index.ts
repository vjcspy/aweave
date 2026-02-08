/**
 * @aweave/cli-shared — Shared utilities for the aw CLI ecosystem.
 *
 * This package provides:
 * - MCP response format models (MCPResponse, MCPContent, MCPError)
 * - HTTP client with error handling
 * - CLI output and content reading helpers
 * - pm2 service management utilities
 *
 * Both the main CLI (@aweave/cli) and all plugins (@aweave/cli-plugin-*)
 * depend on this package. It has NO CLI framework dependency (no oclif, no commander).
 */

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

// pm2 service management
export {
  checkHealth,
  checkPm2Process,
  runCommand,
  startPm2,
  stopPm2,
  waitForHealthy,
} from './services';
