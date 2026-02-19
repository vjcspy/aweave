/**
 * Content reading helpers for CLI commands.
 *
 * Supports --file, --content, and --stdin input patterns.
 * Port of Python _read_content() pattern used across all CLI tools.
 */

import { existsSync, readFileSync } from 'fs';

import { MCPResponse } from '../mcp/response';
import { errorResponse } from './output';

export interface ContentInput {
  file?: string;
  content?: string;
  stdin?: boolean;
}

export interface ContentResult {
  content?: string;
  error?: MCPResponse;
}

/**
 * Read content from file, inline, or stdin.
 *
 * Exactly one source must be provided. Returns error MCPResponse if invalid.
 */
export async function readContent(opts: ContentInput): Promise<ContentResult> {
  const sources = [opts.file, opts.content, opts.stdin].filter(Boolean).length;

  if (sources === 0) {
    return {
      error: errorResponse(
        'INVALID_INPUT',
        'No content provided',
        'Use --file, --content, or --stdin to provide content',
      ),
    };
  }

  if (sources > 1) {
    return {
      error: errorResponse(
        'INVALID_INPUT',
        'Multiple content sources provided',
        'Use only one of --file, --content, or --stdin',
      ),
    };
  }

  if (opts.stdin) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    return { content: Buffer.concat(chunks).toString('utf-8') };
  }

  if (opts.file) {
    if (!existsSync(opts.file)) {
      return {
        error: errorResponse(
          'FILE_NOT_FOUND',
          `File not found: ${opts.file}`,
          'Check the file path and try again',
        ),
      };
    }
    return { content: readFileSync(opts.file, 'utf-8') };
  }

  return { content: opts.content ?? '' };
}
