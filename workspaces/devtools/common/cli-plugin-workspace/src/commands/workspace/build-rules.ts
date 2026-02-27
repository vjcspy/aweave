import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { resolveDevtoolsRoot } from '@hod/aweave-node-shared';
import { Command, Flags } from '@oclif/core';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { basename, relative, resolve } from 'path';

const SOURCE_FILES = [
  'agent/rules/common/user-profile.md',
  'agent/rules/common/global-conventions.md',
  'agent/rules/common/workspace-workflow.md',
  'agent/rules/common/context-memory-rule.md',
];

const OUTPUT_FILE = 'AGENTS.md';

const FRONT_MATTER = `---
generated_from:
${SOURCE_FILES.map((f) => `  - ${f}`).join('\n')}
note: >
  AUTO-GENERATED — do not edit directly.
  Edit the source files listed above, then run: aw workspace build-rules
---`;

export class WorkspaceBuildRules extends Command {
  static description =
    'Combine hot memory source files into a single AGENTS.md-compatible rule file';

  static flags = {
    'project-root': Flags.string({
      description: 'Project root directory (auto-detected from devtools root)',
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
    const projectRoot = flags['project-root'] ?? resolveProjectRoot();

    const sections: string[] = [FRONT_MATTER, '', '# AI Agent Entry Point', ''];

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

    const agentsRulesDir = resolve(projectRoot, '.agents/rules');
    if (!flags['dry-run'] && !existsSync(agentsRulesDir)) {
      mkdirSync(agentsRulesDir, { recursive: true });
    }

    const symlinksCreated: string[] = [];

    for (const relPath of SOURCE_FILES) {
      const fileName = basename(relPath);
      const targetSymlinkPath = resolve(agentsRulesDir, fileName);
      const sourceFilePath = resolve(projectRoot, relPath);
      const relativeTarget = relative(agentsRulesDir, sourceFilePath);

      if (!flags['dry-run']) {
        try {
          if (lstatSync(targetSymlinkPath)) {
            unlinkSync(targetSymlinkPath);
          }
        } catch (e: any) {
          // Ignored
        }
        symlinkSync(relativeTarget, targetSymlinkPath);
      }
      symlinksCreated.push(targetSymlinkPath);
    }

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
                symlinks_created: symlinksCreated,
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
              symlinks_created: symlinksCreated,
            },
          }),
        ],
        metadata: { resource_type: 'build_rules', message: 'Rules combined' },
      }),
      flags.format,
    );
  }
}

function resolveProjectRoot(): string {
  const devtoolsRoot = resolveDevtoolsRoot({
    cwd: process.cwd(),
    moduleDir: __dirname,
  });
  if (!devtoolsRoot) {
    throw new Error(
      'Could not resolve devtools root. Use --project-root flag.',
    );
  }
  return resolve(devtoolsRoot, '..', '..');
}

function stripBudgetComment(content: string): string {
  return content.replace(/^<!--\s*budget:.*-->\s*\n?/m, '');
}

function shiftHeadings(content: string): string {
  return content.replace(/^(#{1,5})\s/gm, (match, hashes: string) => {
    return '#' + hashes + ' ';
  });
}
