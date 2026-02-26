import fg from 'fast-glob';
import { readFileSync } from 'fs';
import { basename, relative } from 'path';

import { parseFrontMatter } from '../../parsers/front-matter';
import type { PlanEntry } from '../types';

export async function getPlans(
  resourcesDir: string,
  projectRoot: string,
  filters?: { status?: string[]; tags?: string[] },
): Promise<PlanEntry[]> {
  const pattern = `${resourcesDir}/**/_plans/*.md`;
  const files = await fg(pattern, { absolute: true });
  const entries: PlanEntry[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const { frontMatter } = parseFrontMatter(content);
    const filename = basename(file, '.md');

    const entry: PlanEntry = {
      name: (frontMatter.name as string) ?? filename,
      description: frontMatter.description as string | undefined,
      status: frontMatter.status as string | undefined,
      created: (frontMatter.created as string) ?? extractDate(filename),
      tags: frontMatter.tags as string[] | undefined,
      _meta: {
        document_path: relative(projectRoot, file),
        document_id: filename,
      },
    };

    if (filters?.status?.length && entry.status) {
      if (!filters.status.includes(entry.status)) continue;
    }

    if (filters?.tags?.length && entry.tags) {
      if (!filters.tags.some((t) => entry.tags!.includes(t))) continue;
    }

    entries.push(entry);
  }

  return entries.sort((a, b) =>
    (b.created ?? '').localeCompare(a.created ?? ''),
  );
}

function extractDate(filename: string): string | undefined {
  const match = filename.match(/^(\d{6})/);
  if (!match) return undefined;
  const d = match[1];
  return `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
}
