import fs from 'node:fs';
import path from 'node:path';

import { getDomainConfigDir } from './paths';
import {
  ConfigDefaultsMissingError,
  type SyncOptions,
  type SyncResult,
} from './types';

// ---------------------------------------------------------------------------
// Sync default configs → user config directory
// ---------------------------------------------------------------------------

/**
 * Copy default config files to the user's config directory.
 *
 * Behaviour:
 *   - Without `force`: skip files that already exist (non-destructive)
 *   - With `force`: overwrite all files
 *   - Creates directories as needed
 *
 * @returns Array of results describing what happened to each file
 */
export function syncDefaultConfigs(options: SyncOptions): SyncResult[] {
  const { domain, defaultsDir, force = false } = options;

  if (!fs.existsSync(defaultsDir)) {
    throw new ConfigDefaultsMissingError(defaultsDir);
  }

  const destDir = getDomainConfigDir(domain);
  fs.mkdirSync(destDir, { recursive: true });

  const yamlFiles = fs
    .readdirSync(defaultsDir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

  const results: SyncResult[] = [];

  for (const file of yamlFiles) {
    const srcPath = path.join(defaultsDir, file);
    const destPath = path.join(destDir, file);
    const exists = fs.existsSync(destPath);

    if (exists && !force) {
      results.push({ file, action: 'skipped', destination: destPath });
      continue;
    }

    fs.copyFileSync(srcPath, destPath);
    results.push({
      file,
      action: exists ? 'overwritten' : 'created',
      destination: destPath,
    });
  }

  return results;
}

/**
 * Discover all YAML files in a defaults directory.
 * Useful for listing available config files without syncing.
 */
export function listDefaultConfigs(defaultsDir: string): string[] {
  if (!fs.existsSync(defaultsDir)) {
    return [];
  }

  return fs
    .readdirSync(defaultsDir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
}
