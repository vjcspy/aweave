#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createWorkspaceMemoryServer } from './server';

const projectRoot = process.env.PROJECT_ROOT || process.cwd();
const server = createWorkspaceMemoryServer(projectRoot);
const transport = new StdioServerTransport();

server.connect(transport).catch((err) => {
  process.stderr.write(`Failed to start STDIO MCP server: ${err}\n`);
  process.exit(1);
});
