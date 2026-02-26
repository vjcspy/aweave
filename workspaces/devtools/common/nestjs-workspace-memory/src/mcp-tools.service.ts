import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Injectable, OnModuleInit } from '@nestjs/common';

import { WorkspaceMemoryService } from './workspace-memory.service';

const TOOLS = [
  {
    name: 'workspace_get_context',
    description:
      'Get workspace context: folder structure, overviews, plans, features, architecture, decisions, lessons, and loaded skills. Topics are auto-discovered from _{topicName}/ folders in resources/.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace: {
          type: 'string',
          description: 'Workspace name (e.g. "devtools")',
        },
        domain: { type: 'string', description: 'Domain within workspace' },
        repository: { type: 'string', description: 'Repository within domain' },
        topics: {
          type: 'string',
          description:
            'Comma-separated topic names (e.g. "plans,decisions,lessons"). Topics map to _{topicName}/ folders in resources/, except "features" which has special handling.',
        },
        include_defaults: {
          type: 'boolean',
          description: 'Include defaults (folder structure, T0, skills)',
          default: true,
        },
        filter_status: {
          type: 'string',
          description: 'Comma-separated status filter',
        },
        filter_tags: {
          type: 'string',
          description: 'Comma-separated tag filter',
        },
        filter_category: {
          type: 'string',
          description: 'Category filter',
        },
      },
      required: ['workspace'],
    },
  },
];

@Injectable()
export class McpToolsService implements OnModuleInit {
  private server!: Server;
  private transports = new Map<string, SSEServerTransport>();

  constructor(private readonly memoryService: WorkspaceMemoryService) {}

  onModuleInit() {
    this.server = new Server(
      { name: 'aweave-workspace-memory', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const params = (args ?? {}) as Record<string, unknown>;

      switch (name) {
        case 'workspace_get_context':
          return this.handleGetContext(params);
        default:
          return {
            content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    });
  }

  private async handleGetContext(params: Record<string, unknown>) {
    const topics = this.memoryService.parseTopics(params.topics as string);
    const includeDefaults =
      params.include_defaults !== undefined
        ? Boolean(params.include_defaults)
        : true;

    const result = await this.memoryService.getContext({
      scope: {
        workspace: params.workspace as string,
        domain: params.domain as string | undefined,
        repository: params.repository as string | undefined,
      },
      topics,
      includeDefaults,
      filters: {
        status: (params.filter_status as string)
          ?.split(',')
          .map((s: string) => s.trim()),
        tags: (params.filter_tags as string)
          ?.split(',')
          .map((t: string) => t.trim()),
        category: params.filter_category as string | undefined,
      },
    });

    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  }

  async handleSseConnection(req: any, res: any): Promise<void> {
    const transport = new SSEServerTransport('/mcp/messages', res);
    this.transports.set(transport.sessionId, transport);

    res.on('close', () => {
      this.transports.delete(transport.sessionId);
    });

    await this.server.connect(transport);
  }

  async handleMessage(req: any, res: any, sessionId: string): Promise<void> {
    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await transport.handlePostMessage(req, res);
  }
}
