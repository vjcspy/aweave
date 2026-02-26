import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function getLessons(memoryDir: string): string | null {
  const filePath = join(memoryDir, 'lessons.md');
  if (!existsSync(filePath)) return null;

  return readFileSync(filePath, 'utf-8');
}
