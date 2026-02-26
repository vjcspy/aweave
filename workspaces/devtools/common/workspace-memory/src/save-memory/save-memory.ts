import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, relative } from 'path';

import { updateIndex } from '../metadata/index-manager';
import { getMemoryPath } from '../shared/paths';
import { createFileHeader, formatEntry } from './format';
import type { SaveMemoryParams, SaveMemoryResult } from './types';

export function saveMemory(
  projectRoot: string,
  params: SaveMemoryParams,
): SaveMemoryResult {
  const { scope, type, title, content, category, tags } = params;
  const memoryDir = getMemoryPath(projectRoot, scope);
  const filename = type === 'decision' ? 'decisions.md' : 'lessons.md';
  const filePath = `${memoryDir}/${filename}`;

  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const entry = formatEntry(type, title, content, category, tags);

  if (!existsSync(filePath)) {
    writeFileSync(filePath, createFileHeader(type) + entry, 'utf-8');
  } else {
    appendFileSync(filePath, entry, 'utf-8');
  }

  updateIndex(
    projectRoot,
    scope.workspace,
    type === 'decision' ? 'decisions' : 'lessons',
    tags,
    category,
  );

  return {
    success: true,
    filePath: relative(projectRoot, filePath),
    type,
    title,
  };
}
