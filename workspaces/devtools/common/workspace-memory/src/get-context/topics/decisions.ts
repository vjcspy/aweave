import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function getDecisions(memoryDir: string): string | null {
  const filePath = join(memoryDir, 'decisions.md');
  if (!existsSync(filePath)) return null;

  return readFileSync(filePath, 'utf-8');
}
