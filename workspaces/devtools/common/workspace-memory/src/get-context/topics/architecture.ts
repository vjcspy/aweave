import fg from 'fast-glob';
import { relative } from 'path';

import type { ArchitectureEntry } from '../types';

export async function getArchitecture(
  resourcesDir: string,
  projectRoot: string,
): Promise<ArchitectureEntry[]> {
  const pattern = `${resourcesDir}/**/_architecture/**/*.md`;
  const files = await fg(pattern, { absolute: true });
  const entries: ArchitectureEntry[] = [];

  for (const file of files) {
    const relPath = relative(projectRoot, file);
    const parts = relPath.split('/');
    const archIdx = parts.indexOf('_architecture');
    const name =
      archIdx >= 0
        ? parts
            .slice(archIdx + 1)
            .join('/')
            .replace(/\.md$/, '')
        : relPath;

    entries.push({
      name,
      path: relPath,
      _meta: {
        document_path: relPath,
        document_id: name,
      },
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
