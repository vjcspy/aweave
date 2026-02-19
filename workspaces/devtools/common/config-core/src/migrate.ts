import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { getDomainConfigDir } from './paths';
import { type MigrateOptions, type MigrateResult } from './types';

// ---------------------------------------------------------------------------
// Legacy config migration (non-destructive)
// ---------------------------------------------------------------------------

/**
 * Migrate legacy config files to the new centralized config structure.
 *
 * Behaviour:
 *   - Copies legacy files to new location (does NOT delete originals)
 *   - JSON legacy files are converted to YAML
 *   - Skips migration if target file already exists
 *   - Returns results describing what happened to each file
 */
export function migrateFromLegacy(options: MigrateOptions): MigrateResult[] {
  const { domain, legacyFiles } = options;

  if (!legacyFiles || Object.keys(legacyFiles).length === 0) {
    return [];
  }

  const destDir = getDomainConfigDir(domain);
  fs.mkdirSync(destDir, { recursive: true });

  const results: MigrateResult[] = [];

  for (const [legacyPath, newName] of Object.entries(legacyFiles)) {
    const expandedPath = expandHome(legacyPath);
    const destPath = path.join(destDir, `${newName}.yaml`);

    if (!fs.existsSync(expandedPath)) {
      results.push({
        legacyPath: expandedPath,
        newPath: destPath,
        action: 'not_found',
        message: `Legacy file not found: ${expandedPath}`,
      });
      continue;
    }

    if (fs.existsSync(destPath)) {
      results.push({
        legacyPath: expandedPath,
        newPath: destPath,
        action: 'skipped',
        message: `Target already exists: ${destPath} (legacy file preserved at ${expandedPath})`,
      });
      continue;
    }

    // Read legacy file and convert if needed
    const raw = fs.readFileSync(expandedPath, 'utf-8');
    let content: string;

    if (expandedPath.endsWith('.json')) {
      // Convert JSON → YAML
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      content = YAML.stringify(parsed);
    } else {
      content = raw;
    }

    fs.writeFileSync(destPath, content, 'utf-8');

    results.push({
      legacyPath: expandedPath,
      newPath: destPath,
      action: 'migrated',
      message: `Migrated ${expandedPath} → ${destPath}`,
    });
  }

  return results;
}

/**
 * Expand `~` prefix to the user's home directory.
 */
function expandHome(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      filePath.slice(1),
    );
  }
  return filePath;
}
