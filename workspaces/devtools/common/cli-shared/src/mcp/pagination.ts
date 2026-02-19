/**
 * Pagination utilities for MCP responses.
 */

import { MCPContent, MCPResponse } from './response';

export function createPaginatedResponse<T>(opts: {
  items: T[];
  total: number | undefined;
  hasMore: boolean;
  nextOffset: number | undefined;
  formatter: (item: T) => MCPContent;
  metadata?: Record<string, unknown>;
}): MCPResponse {
  const content = opts.items.map(opts.formatter);

  return new MCPResponse({
    success: true,
    content,
    metadata: opts.metadata ?? {},
    hasMore: opts.hasMore,
    nextOffset: opts.nextOffset,
    totalCount: opts.total,
  });
}
