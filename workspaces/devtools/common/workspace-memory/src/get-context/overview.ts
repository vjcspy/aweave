import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

import { parseFrontMatter } from '../parsers/front-matter';

function readOverviewBody(filePath: string): string | null {
  if (!existsSync(filePath)) return null;

  const content = readFileSync(filePath, 'utf-8');
  const { body } = parseFrontMatter(content);
  return body || null;
}

export function loadScopeOverviewT1(resourcesDir: string): string | null {
  return readOverviewBody(join(resourcesDir, 'OVERVIEW.md'));
}

export function loadTopicOverviewT1(
  topicName: string,
  resourcesDir: string,
  projectRoot: string,
): string | null {
  const workspaceRoot = resolve(projectRoot, 'resources', 'workspaces');
  let currentDir = resolve(resourcesDir);

  while (true) {
    const candidate = join(currentDir, `_${topicName}`, 'OVERVIEW.md');
    const topicOverview = readOverviewBody(candidate);
    if (topicOverview !== null) return topicOverview;

    if (currentDir === workspaceRoot) {
      return null;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    const relToWorkspaceRoot = relative(workspaceRoot, parentDir);
    if (relToWorkspaceRoot.startsWith('..')) {
      return null;
    }

    currentDir = parentDir;
  }
}
