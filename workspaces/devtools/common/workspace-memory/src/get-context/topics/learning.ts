import fg from 'fast-glob';
import { readFileSync } from 'fs';
import { basename, relative } from 'path';

import { parseFrontMatter } from '../../parsers/front-matter';
import type { LearningTopicEntry, TopicContext } from '../types';

type LearningTopic = 'decisions' | 'lessons';

export async function scanLearningTopic(
  topicName: LearningTopic,
  ctx: TopicContext,
): Promise<LearningTopicEntry[]> {
  const { resourcesDir, projectRoot, filters } = ctx;
  const pattern = `${resourcesDir}/**/_${topicName}/**/*.md`;
  const files = await fg(pattern, {
    absolute: true,
    ignore: ['**/OVERVIEW.md'],
  });
  const entries: LearningTopicEntry[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const { frontMatter, body } = parseFrontMatter(content);
    const relPath = relative(projectRoot, file);
    const filename = basename(file, '.md');

    const name = (frontMatter.name as string) ?? filename;
    const status = frontMatter.status as string | undefined;
    const category = frontMatter.category as string | undefined;
    const tags = frontMatter.tags as string[] | undefined;

    if (filters?.status?.length && status) {
      if (!filters.status.includes(status)) continue;
    }

    if (filters?.tags?.length && tags) {
      if (!filters.tags.some((t) => tags.includes(t))) continue;
    }

    if (filters?.category && category) {
      if (filters.category !== category) continue;
    }

    entries.push({
      ...frontMatter,
      name,
      description: (frontMatter.description as string) ?? '',
      path: relPath,
      body_t1: body,
      _meta: {
        document_path: relPath,
      },
    });
  }

  return entries.sort((a, b) => {
    const aCreated = a.created as string | undefined;
    const bCreated = b.created as string | undefined;
    if (aCreated && bCreated) return bCreated.localeCompare(aCreated);
    if (aCreated) return -1;
    if (bCreated) return 1;
    return a.name.localeCompare(b.name);
  });
}
