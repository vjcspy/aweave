import type { MemoryType } from './types';

export function formatEntry(
  type: MemoryType,
  title: string,
  content: string,
  category?: string,
  tags?: string[],
): string {
  const date = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  lines.push(`### [${date}] ${title}`);
  lines.push('');

  if (category) {
    lines.push(`**Category:** ${category}`);
  }

  if (tags && tags.length > 0) {
    lines.push(`**Tags:** ${tags.join(', ')}`);
  }

  if (category || (tags && tags.length > 0)) {
    lines.push('');
  }

  lines.push(content);
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

export function createFileHeader(type: MemoryType): string {
  const title = type === 'decision' ? 'Decisions' : 'Lessons Learned';
  return `# ${title}\n\n`;
}
