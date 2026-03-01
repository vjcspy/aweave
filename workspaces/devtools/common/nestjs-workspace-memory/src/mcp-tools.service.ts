import { createWorkspaceMemoryServer } from '@hod/aweave-mcp-workspace-memory';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { resolve } from 'path';

@Injectable()
export class McpToolsService implements OnModuleInit {
  private server!: Server;

  onModuleInit() {
    const projectRoot = resolve(process.cwd(), '..', '..', '..');
    this.server = createWorkspaceMemoryServer(projectRoot);
  }

  async handleRequest(req: any, res: any): Promise<void> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      void transport.close();
    });

    await this.server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
