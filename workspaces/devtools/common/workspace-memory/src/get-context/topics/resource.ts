import fg from 'fast-glob';
import { readFileSync } from 'fs';
import { basename, relative } from 'path';

import { parseFrontMatter } from '../../parsers/front-matter';
import type { EntryMeta, TopicContext } from '../types';

export interface ResourceEntry {
  name: string;
  path: string;
  _meta: EntryMeta;
  [key: string]: unknown;
}

export async function scanResourceTopic(
  topicName: string,
  ctx: TopicContext,
): Promise<ResourceEntry[]> {
  const { resourcesDir, projectRoot, filters } = ctx;
  const pattern = `${resourcesDir}/**/_${topicName}/**/*.md`;
  const files = await fg(pattern, {
    absolute: true,
    ignore: ['**/OVERVIEW.md'],
  });
  const entries: ResourceEntry[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const { frontMatter } = parseFrontMatter(content);
    const relPath = relative(projectRoot, file);
    const filename = basename(file, '.md');

    const name = (frontMatter.name as string) ?? filename;
    const status = frontMatter.status as string | undefined;
    const tags = frontMatter.tags as string[] | undefined;

    if (filters?.status?.length && status) {
      if (!filters.status.includes(status)) continue;
    }

    if (filters?.tags?.length && tags) {
      if (!filters.tags.some((t) => tags.includes(t))) continue;
    }

    entries.push({
      ...frontMatter,
      name,
      path: relPath,
      _meta: {
        document_path: relPath,
      },
    });
  }

  return entries.sort((a, b) => {
    const aCreated = a.created as string | undefined;
    const bCreated = b.created as string | undefined;
    if (aCreated && bCreated) return bCreated.localeCompare(aCreated);
    return a.name.localeCompare(b.name);
  });
}
