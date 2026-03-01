import { createLogger } from '@hod/aweave-node-shared';
import { getContext } from '@hod/aweave-workspace-memory';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  TOOL_DESCRIPTION,
  TOOL_NAME,
  type WorkspaceGetContextInput,
  workspaceGetContextInputSchema,
} from './tools';

const logger = createLogger({
  name: 'mcp-workspace-memory',
  service: 'mcp-workspace-memory',
});

export function createWorkspaceMemoryServer(projectRoot: string): McpServer {
  logger.info({ projectRoot }, 'Creating workspace memory MCP server');

  const server = new McpServer(
    { name: 'aweave-workspace-memory', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    TOOL_NAME,
    {
      description: TOOL_DESCRIPTION,
      inputSchema: workspaceGetContextInputSchema,
    },
    async (args: WorkspaceGetContextInput) => {
      const startTime = Date.now();
      const {
        workspace,
        domain,
        repository,
        topics,
        include_defaults,
        filter_status,
        filter_tags,
        filter_category,
      } = args;

      logger.info(
        { workspace, domain, repository, topics, include_defaults },
        'workspace_get_context called',
      );

      try {
        const result = await getContext(projectRoot, {
          scope: { workspace, domain, repository },
          topics: normalizeList(topics),
          includeDefaults: include_defaults ?? true,
          filters: {
            status: normalizeList(filter_status),
            tags: normalizeList(filter_tags),
            category: filter_category,
          },
        });

        const elapsed = Date.now() - startTime;
        logger.info(
          { workspace, domain, topics, elapsed },
          'workspace_get_context completed',
        );

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (error) {
        const elapsed = Date.now() - startTime;
        logger.error(
          { err: error, workspace, domain, topics, elapsed },
          'workspace_get_context failed',
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

function normalizeList(
  value: string | string[] | undefined,
): string[] | undefined {
  if (value === undefined) return undefined;

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return value.filter((s) => s.length > 0);
}
