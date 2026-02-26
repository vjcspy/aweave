import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { getIndexPath, getMemoryPath } from '../shared/paths';
import type { CategoryEntry, IndexSchema, TagEntry } from './types';

export function readIndex(
  projectRoot: string,
  workspace: string,
): IndexSchema | null {
  const indexPath = getIndexPath(projectRoot, workspace);
  if (!existsSync(indexPath)) return null;

  try {
    const content = readFileSync(indexPath, 'utf-8');
    const parsed = parseYaml(content) as IndexSchema;
    if (parsed?.schema_version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function bootstrapIndex(
  projectRoot: string,
  workspace: string,
): IndexSchema {
  const memoryDir = getMemoryPath(projectRoot, { workspace });
  const tagsMap = new Map<string, Set<string>>();
  const categoriesMap = new Map<string, Set<string>>();

  for (const type of ['decisions', 'lessons'] as const) {
    const filePath = join(memoryDir, `${type}.md`);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, 'utf-8');
    extractMetadataFromEntries(content, type, tagsMap, categoriesMap);
  }

  const tags: TagEntry[] = Array.from(tagsMap.entries()).map(
    ([name, usedIn]) => ({
      name,
      used_in: Array.from(usedIn),
    }),
  );

  const categories: CategoryEntry[] = Array.from(categoriesMap.entries()).map(
    ([name, usedIn]) => ({
      name,
      used_in: Array.from(usedIn),
    }),
  );

  const index: IndexSchema = {
    schema_version: 1,
    workspace,
    last_updated: new Date().toISOString().split('T')[0],
    tags,
    categories,
  };

  writeIndex(projectRoot, workspace, index);
  return index;
}

export function getOrBootstrapIndex(
  projectRoot: string,
  workspace: string,
): { index: IndexSchema; bootstrapped: boolean } {
  const existing = readIndex(projectRoot, workspace);
  if (existing) return { index: existing, bootstrapped: false };

  const index = bootstrapIndex(projectRoot, workspace);
  return { index, bootstrapped: true };
}

export function updateIndex(
  projectRoot: string,
  workspace: string,
  type: 'decisions' | 'lessons',
  tags?: string[],
  category?: string,
): void {
  const { index } = getOrBootstrapIndex(projectRoot, workspace);

  if (tags) {
    for (const tagName of tags) {
      const existing = index.tags.find((t) => t.name === tagName);
      if (existing) {
        if (!existing.used_in.includes(type)) existing.used_in.push(type);
      } else {
        index.tags.push({ name: tagName, used_in: [type] });
      }
    }
  }

  if (category) {
    const existing = index.categories.find((c) => c.name === category);
    if (existing) {
      if (!existing.used_in.includes(type)) existing.used_in.push(type);
    } else {
      index.categories.push({ name: category, used_in: [type] });
    }
  }

  index.last_updated = new Date().toISOString().split('T')[0];
  writeIndex(projectRoot, workspace, index);
}

function writeIndex(
  projectRoot: string,
  workspace: string,
  index: IndexSchema,
): void {
  const indexPath = getIndexPath(projectRoot, workspace);
  const dir = dirname(indexPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const tmpPath = indexPath + '.tmp';
  writeFileSync(tmpPath, stringifyYaml(index), 'utf-8');
  renameSync(tmpPath, indexPath);
}

function extractMetadataFromEntries(
  content: string,
  type: string,
  tagsMap: Map<string, Set<string>>,
  categoriesMap: Map<string, Set<string>>,
): void {
  const entryBlocks = content.split(/^---$/m);

  for (const block of entryBlocks) {
    const categoryMatch = block.match(/\*\*Category:\*\*\s*(.+)/i);
    if (categoryMatch) {
      const category = categoryMatch[1].trim();
      if (!categoriesMap.has(category)) categoriesMap.set(category, new Set());
      categoriesMap.get(category)!.add(type);
    }

    const tagsMatch = block.match(/\*\*Tags:\*\*\s*(.+)/i);
    if (tagsMatch) {
      const tags = tagsMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      for (const tag of tags) {
        if (!tagsMap.has(tag)) tagsMap.set(tag, new Set());
        tagsMap.get(tag)!.add(type);
      }
    }
  }
}
