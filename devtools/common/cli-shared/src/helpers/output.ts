/**
 * Output helpers for CLI commands.
 *
 * Provides consistent output formatting across all CLI tools.
 */

import { MCPError, MCPResponse } from '../mcp/response';

/**
 * Output MCPResponse in the requested format.
 *
 * @param response - MCPResponse to output
 * @param format - Output format: 'json' or 'markdown'
 * @param readableContent - If true, unescape newlines in content fields for better
 *   AI agent readability. Use for read commands (get-context, wait).
 *   Note: Creates non-standard JSON but most parsers accept it.
 */
export function output(
  response: MCPResponse,
  format: string,
  readableContent = false,
): void {
  if (format === 'markdown') {
    console.log(response.toMarkdown());
  } else {
    let json = response.toJSON();
    if (readableContent) {
      // Replace escaped newlines/tabs with actual characters
      // Matches Python behavior in debate CLI
      json = json.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    }
    console.log(json);
  }
}

/**
 * Create a standard error MCPResponse.
 */
export function errorResponse(
  code: string,
  message: string,
  suggestion?: string,
): MCPResponse {
  return new MCPResponse({
    success: false,
    error: new MCPError({ code, message, suggestion }),
  });
}

/**
 * Handle HTTPClientError and exit with appropriate code.
 */
export function handleServerError(
  e: { code: string; message: string; suggestion?: string },
  format: string,
): never {
  const exitCode: Record<string, number> = {
    NOT_FOUND: 2,
    DEBATE_NOT_FOUND: 2,
    ARGUMENT_NOT_FOUND: 2,
    INVALID_INPUT: 4,
    ACTION_NOT_ALLOWED: 5,
    AUTH_FAILED: 6,
    FORBIDDEN: 6,
  };

  output(errorResponse(e.code, e.message, e.suggestion), format);
  process.exit(exitCode[e.code] ?? 3);
}
