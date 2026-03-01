import { createWorkspaceMemoryServer } from '@hod/aweave-mcp-workspace-memory';
import { resolveProjectRootFromDevtools } from '@hod/aweave-node-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class McpToolsService implements OnModuleInit {
  private server!: McpServer;

  onModuleInit() {
    const projectRoot = resolveProjectRootFromDevtools({
      cwd: process.cwd(),
      moduleDir: __dirname,
    });

    if (!projectRoot) {
      throw new Error(
        'Could not resolve project root. Set AWEAVE_DEVTOOLS_ROOT or run from within the aweave workspace.',
      );
    }

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
