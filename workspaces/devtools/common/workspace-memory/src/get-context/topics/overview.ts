import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function getOverview(resourcesDir: string): string | null {
  const overviewPath = join(resourcesDir, 'OVERVIEW.md');
  if (!existsSync(overviewPath)) return null;

  return readFileSync(overviewPath, 'utf-8');
}
