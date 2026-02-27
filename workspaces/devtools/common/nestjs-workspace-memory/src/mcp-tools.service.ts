import { createWorkspaceMemoryServer } from '@hod/aweave-mcp-workspace-memory';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { resolve } from 'path';

@Injectable()
export class McpToolsService implements OnModuleInit {
  private server!: Server;
  private transports = new Map<string, SSEServerTransport>();

  onModuleInit() {
    const projectRoot = resolve(process.cwd(), '..', '..', '..');
    this.server = createWorkspaceMemoryServer(projectRoot);
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
