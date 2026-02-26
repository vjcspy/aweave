import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

interface TreeOptions {
  maxDepth?: number;
  baseDir?: string;
}

export function generateFolderStructure(
  dir: string,
  options: TreeOptions = {},
): string {
  const { maxDepth = 4, baseDir } = options;
  const displayBase = baseDir ? relative(baseDir, dir) : dir;
  const lines: string[] = [`${displayBase}/`];

  buildTree(dir, '', 0, maxDepth, lines);

  return lines.join('\n');
}

function buildTree(
  dir: string,
  prefix: string,
  depth: number,
  maxDepth: number,
  lines: string[],
): void {
  if (depth >= maxDepth) return;

  let entries: string[];
  try {
    entries = readdirSync(dir).filter((e) => !e.startsWith('.'));
  } catch {
    return;
  }

  entries.sort((a, b) => {
    const aIsDir = isDirectory(join(dir, a));
    const bIsDir = isDirectory(join(dir, b));
    if (aIsDir !== bIsDir) return aIsDir ? 1 : -1;
    return a.localeCompare(b);
  });

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    const fullPath = join(dir, entry);
    const isDir = isDirectory(fullPath);

    lines.push(`${prefix}${connector}${entry}${isDir ? '/' : ''}`);

    if (isDir) {
      buildTree(fullPath, prefix + childPrefix, depth + 1, maxDepth, lines);
    }
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
