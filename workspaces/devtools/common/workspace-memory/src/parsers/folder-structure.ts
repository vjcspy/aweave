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
    entries = readdirSync(dir).filter((entry) => {
      if (entry.startsWith('.')) return false;
      return isDirectory(join(dir, entry));
    });
  } catch {
    return;
  }

  entries.sort((a, b) => a.localeCompare(b));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    const fullPath = join(dir, entry);
    lines.push(`${prefix}${connector}${entry}/`);

    if (shouldStopAtDirectory(entry, depth, maxDepth)) continue;
    buildTree(fullPath, prefix + childPrefix, depth + 1, maxDepth, lines);
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function shouldStopAtDirectory(
  directoryName: string,
  depth: number,
  maxDepth: number,
): boolean {
  if (directoryName.startsWith('_')) return true;
  return depth + 1 >= maxDepth;
}
