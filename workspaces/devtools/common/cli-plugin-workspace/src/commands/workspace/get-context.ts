import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { resolveDevtoolsRoot } from '@hod/aweave-node-shared';
import { getContext } from '@hod/aweave-workspace-memory';
import { Command, Flags } from '@oclif/core';
import { resolve } from 'path';

function resolveProjectRoot(): string {
  const devtoolsRoot = resolveDevtoolsRoot({
    cwd: process.cwd(),
    moduleDir: __dirname,
  });
  if (!devtoolsRoot) {
    throw new Error('Could not resolve devtools root.');
  }
  return resolve(devtoolsRoot, '..', '..');
}

export class WorkspaceGetContext extends Command {
  static description = 'Get workspace context (calls core directly, no server)';

  static flags = {
    workspace: Flags.string({
      char: 'w',
      required: true,
      description: 'Workspace name (e.g. devtools)',
    }),
    domain: Flags.string({
      char: 'd',
      description: 'Domain within workspace',
    }),
    repository: Flags.string({
      char: 'r',
      description: 'Repository within domain',
    }),
    topics: Flags.string({
      char: 't',
      description:
        'Comma-separated topic names (each topic returns { overview_t1, entries })',
    }),
    'no-defaults': Flags.boolean({
      default: false,
      description:
        'Skip defaults (scope_overview_t1, folder_structure, overviews, loaded_skills)',
    }),
    'filter-status': Flags.string({
      description: 'Comma-separated status filter for plans',
    }),
    'filter-tags': Flags.string({
      description: 'Comma-separated tag filter',
    }),
    'filter-category': Flags.string({
      description: 'Category filter for decisions/lessons',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(WorkspaceGetContext);
    const projectRoot = resolveProjectRoot();

    const topics = flags.topics
      ? flags.topics.split(',').map((t) => t.trim())
      : undefined;

    const result = await getContext(projectRoot, {
      scope: {
        workspace: flags.workspace,
        domain: flags.domain,
        repository: flags.repository,
      },
      topics,
      includeDefaults: !flags['no-defaults'],
      filters: {
        status: flags['filter-status']?.split(',').map((s) => s.trim()),
        tags: flags['filter-tags']?.split(',').map((t) => t.trim()),
        category: flags['filter-category'],
      },
    });

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: result as unknown as Record<string, unknown>,
          }),
        ],
        metadata: { resource_type: 'workspace_context' },
      }),
      flags.format,
    );
  }
}
