import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
  readContent,
} from '@hod/aweave-cli-shared';
import { resolveDevtoolsRoot } from '@hod/aweave-node-shared';
import { MemoryType, saveMemory } from '@hod/aweave-workspace-memory';
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

export class WorkspaceSaveMemory extends Command {
  static description =
    'Save a decision or lesson to workspace memory (calls core directly, no server)';

  static flags = {
    workspace: Flags.string({
      char: 'w',
      required: true,
      description: 'Workspace name',
    }),
    domain: Flags.string({
      char: 'd',
      description: 'Domain within workspace',
    }),
    type: Flags.string({
      char: 'T',
      required: true,
      options: ['decision', 'lesson'],
      description: 'Entry type',
    }),
    title: Flags.string({
      required: true,
      description: 'Entry title',
    }),
    content: Flags.string({
      description: 'Entry content (inline)',
    }),
    file: Flags.string({
      description: 'Read content from file',
    }),
    stdin: Flags.boolean({
      default: false,
      description: 'Read content from stdin',
    }),
    category: Flags.string({
      description: 'Category classification',
    }),
    tags: Flags.string({
      description: 'Comma-separated tags',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(WorkspaceSaveMemory);
    const projectRoot = resolveProjectRoot();

    const rawContent = await readContent({
      content: flags.content,
      file: flags.file,
      stdin: flags.stdin,
    });

    const content =
      typeof rawContent === 'string' ? rawContent : String(rawContent ?? '');
    if (!content) {
      this.error('Content is required. Use --content, --file, or --stdin.');
    }

    const result = saveMemory(projectRoot, {
      scope: {
        workspace: flags.workspace,
        domain: flags.domain,
      },
      type: flags.type as MemoryType,
      title: flags.title,
      content,
      category: flags.category,
      tags: flags.tags?.split(',').map((t) => t.trim()),
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
        metadata: { resource_type: 'workspace_memory', message: 'Saved' },
      }),
      flags.format,
    );
  }
}
