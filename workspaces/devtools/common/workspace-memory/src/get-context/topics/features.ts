import fg from 'fast-glob';
import { relative } from 'path';

import type { FeatureEntry, TopicContext } from '../types';

export async function scanFeatures(ctx: TopicContext): Promise<FeatureEntry[]> {
  const { resourcesDir, projectRoot } = ctx;
  const pattern = `${resourcesDir}/**/_features/**/*.md`;
  const files = await fg(pattern, {
    absolute: true,
    ignore: ['**/OVERVIEW.md'],
  });
  const entries: FeatureEntry[] = [];

  for (const file of files) {
    const relPath = relative(projectRoot, file);
    const parts = relPath.split('/');
    const featureIdx = parts.indexOf('_features');
    const name =
      featureIdx >= 0
        ? parts
            .slice(featureIdx + 1)
            .join('/')
            .replace(/\.md$/, '')
        : relPath;

    entries.push({
      name,
      path: relPath,
      _meta: {
        document_path: relPath,
      },
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
