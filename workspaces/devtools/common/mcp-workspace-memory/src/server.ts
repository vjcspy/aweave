import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { handleToolCall } from './handlers';
import { WORKSPACE_TOOLS } from './tools';

export function createWorkspaceMemoryServer(projectRoot: string): Server {
  const server = new Server(
    { name: 'aweave-workspace-memory', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: WORKSPACE_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(
      projectRoot,
      name,
      (args ?? {}) as Record<string, unknown>,
    );
  });

  return server;
}
