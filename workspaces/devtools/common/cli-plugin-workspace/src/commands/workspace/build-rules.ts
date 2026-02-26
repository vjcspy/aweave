import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SOURCE_FILES = [
  'agent/rules/common/user-profile.md',
  'agent/rules/common/global-conventions.md',
  'agent/rules/common/workspace-workflow.md',
  'agent/rules/common/context-memory-rule.md',
];

const OUTPUT_FILE = 'agent/rules/common/agent-entry-point.md';

const FRONT_MATTER = `---
source_of: AGENTS.md
generated_from:
${SOURCE_FILES.map((f) => `  - ${f}`).join('\n')}
note: >
  Combined from individual source files listed above.
  Edit the source files, then regenerate with \`aw workspace build-rules\`.
---`;

export class WorkspaceBuildRules extends Command {
  static description =
    'Combine hot memory source files into a single AGENTS.md-compatible rule file';

  static flags = {
    'project-root': Flags.string({
      description: 'Project root directory (defaults to 3 levels up from cwd)',
    }),
    'dry-run': Flags.boolean({
      default: false,
      description: 'Show what would be written without writing',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(WorkspaceBuildRules);
    const projectRoot =
      flags['project-root'] ?? resolve(process.cwd(), '..', '..', '..');

    const sections: string[] = [FRONT_MATTER, '', '# AI Agent Entry Point', ''];
    sections.push(
      'Act as a **Senior AI Agent Engineer, Software Architect, and Technical Writer**.',
    );
    sections.push('');

    for (const relPath of SOURCE_FILES) {
      const fullPath = resolve(projectRoot, relPath);
      if (!existsSync(fullPath)) {
        this.warn(`Source file not found: ${relPath}`);
        continue;
      }

      let content = readFileSync(fullPath, 'utf-8');
      content = stripBudgetComment(content);
      content = shiftHeadings(content);
      sections.push(content.trim());
      sections.push('');
    }

    const combined = sections.join('\n');

    if (flags['dry-run']) {
      output(
        new MCPResponse({
          success: true,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: {
                dry_run: true,
                output_file: OUTPUT_FILE,
                line_count: combined.split('\n').length,
                char_count: combined.length,
              },
            }),
          ],
          metadata: { resource_type: 'build_rules' },
        }),
        flags.format,
      );
      return;
    }

    const outputPath = resolve(projectRoot, OUTPUT_FILE);
    writeFileSync(outputPath, combined, 'utf-8');

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              output_file: OUTPUT_FILE,
              line_count: combined.split('\n').length,
              source_files: SOURCE_FILES,
            },
          }),
        ],
        metadata: { resource_type: 'build_rules', message: 'Rules combined' },
      }),
      flags.format,
    );
  }
}

function stripBudgetComment(content: string): string {
  return content.replace(/^<!--\s*budget:.*-->\s*\n?/m, '');
}

function shiftHeadings(content: string): string {
  return content.replace(/^(#{1,5})\s/gm, (match, hashes: string) => {
    return '#' + hashes + ' ';
  });
}
