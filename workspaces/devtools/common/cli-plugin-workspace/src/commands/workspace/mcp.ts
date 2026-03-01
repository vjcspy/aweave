import { createWorkspaceMemoryServer } from '@hod/aweave-mcp-workspace-memory';
import { resolveProjectRootFromDevtools } from '@hod/aweave-node-shared';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command, Flags } from '@oclif/core';
import { isAbsolute, resolve } from 'path';

import { log } from '../../lib/logger';

function resolveProjectRoot(projectRootFlag?: string): string {
  if (projectRootFlag) {
    if (!isAbsolute(projectRootFlag)) {
      throw new Error('--project-root must be an absolute path.');
    }

    return resolve(projectRootFlag);
  }

  const projectRoot = resolveProjectRootFromDevtools({
    cwd: process.cwd(),
    moduleDir: __dirname,
  });

  if (!projectRoot) {
    throw new Error(
      'Could not resolve project root. Set AWEAVE_DEVTOOLS_ROOT or pass --project-root /absolute/path/to/aweave.',
    );
  }

  return projectRoot;
}

export class WorkspaceMcp extends Command {
  static description = 'Start the Workspace Memory MCP STDIO Server';

  static flags = {
    'project-root': Flags.string({
      description: 'Absolute path to monorepo root (fallback override)',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WorkspaceMcp);

    const projectRoot = resolveProjectRoot(flags['project-root']);
    log.info({ projectRoot }, 'workspace mcp: starting STDIO server');

    const server = createWorkspaceMemoryServer(projectRoot);
    const transport = new StdioServerTransport();

    log.debug('workspace mcp: connecting transport');
    await server.connect(transport);
    log.info('workspace mcp: transport connected, serving');
  }
}
