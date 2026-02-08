/**
 * aw dashboard workspace — Workspace packages + build status.
 *
 * Standalone panel: renders WorkspacePanel only.
 * Supports --format json for non-interactive output.
 * One-shot by default (static data).
 */

import { Command, Flags } from '@oclif/core';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export class DashboardWorkspace extends Command {
  static description = 'Show workspace packages and build status';

  static flags = {
    format: Flags.string({
      description: 'Output format',
      options: ['json'],
    }),
  };

  async run() {
    const { flags } = await this.parse(DashboardWorkspace);

    if (flags.format === 'json') {
      await this.outputJson();
      return;
    }

    // Interactive Ink rendering
    const { render } = await import('ink');
    const React = await import('react');
    const { WorkspacePanel } = await import(
      '../../components/panels/WorkspacePanel.js'
    );

    const instance = render(React.createElement(WorkspacePanel));

    // One-shot: wait for scan, then stay rendered
    setTimeout(() => {
      instance.unmount();
    }, 5000);
  }

  private async outputJson(): Promise<void> {
    const filePath = fileURLToPath(import.meta.url);
    // dist/commands/dashboard/workspace.js → up 6 levels → devtools/
    const devtoolsRoot = resolve(filePath, '..', '..', '..', '..', '..', '..');
    const workspaceYaml = resolve(devtoolsRoot, 'pnpm-workspace.yaml');

    try {
      const content = await readFile(workspaceYaml, 'utf-8');
      const packages: Array<{ name: string; path: string; built: boolean }> = [];
      const lines = content.split('\n');
      let inPackages = false;

      for (const line of lines) {
        if (line.trim() === 'packages:') {
          inPackages = true;
          continue;
        }
        if (inPackages && line.trim().startsWith('- ')) {
          const pkgPath = line.trim().slice(2).trim();
          const fullPath = resolve(devtoolsRoot, pkgPath);

          let name = pkgPath.split('/').pop() ?? pkgPath;
          try {
            const pkgJson = await readFile(
              resolve(fullPath, 'package.json'),
              'utf-8',
            );
            const parsed = JSON.parse(pkgJson) as { name?: string };
            if (parsed.name) name = parsed.name;
          } catch {
            // Use folder name
          }

          let built = false;
          try {
            await access(resolve(fullPath, 'dist'));
            built = true;
          } catch {
            try {
              await access(resolve(fullPath, '.next'));
              built = true;
            } catch {
              // Not built
            }
          }

          packages.push({ name, path: pkgPath, built });
        } else if (inPackages && !line.trim().startsWith('-') && line.trim() !== '') {
          break;
        }
      }

      const builtCount = packages.filter((p) => p.built).length;
      this.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          packages,
          summary: {
            total: packages.length,
            built: builtCount,
            notBuilt: packages.length - builtCount,
          },
        }),
      );
    } catch (err) {
      this.error(
        `Failed to scan workspace: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }
}
