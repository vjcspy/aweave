/**
 * Shared helpers for docs CLI commands.
 */

import { errorResponse, MCPResponse } from '@aweave/cli-shared';

export function validateFormatNoPlain(
  format: string,
  command: string,
): MCPResponse | null {
  if (format === 'plain') {
    return errorResponse(
      'INVALID_INPUT',
      `--format plain is not supported for '${command}' command`,
      'Use --format json or --format markdown',
    );
  }
  return null;
}

export function parseMetadata(
  metadataStr: string,
): [Record<string, unknown> | null, MCPResponse | null] {
  try {
    const parsed = JSON.parse(metadataStr);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return [
        null,
        errorResponse(
          'INVALID_INPUT',
          `--metadata must be a JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`,
          'Provide JSON object, e.g. \'{"key": "value"}\'',
        ),
      ];
    }
    return [parsed as Record<string, unknown>, null];
  } catch (e) {
    return [
      null,
      errorResponse(
        'INVALID_INPUT',
        `Invalid JSON in --metadata: ${(e as Error).message}`,
        'Provide valid JSON object, e.g. \'{"key": "value"}\'',
      ),
    ];
  }
}
