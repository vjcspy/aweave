import fs from 'node:fs';
import path from 'node:path';

import { resolveDevtoolsRoot } from '@hod/aweave-node-shared';

// ---------------------------------------------------------------------------
// Domain defaults discovery
// ---------------------------------------------------------------------------

interface DomainDefaults {
  domain: string;
  defaultsDir: string;
}

/**
 * Discover domain config packages that have a `defaults/` directory.
 *
 * Scans known domain paths in the devtools monorepo for packages
 * that export default config files.
 *
 * @param domainFilter  If provided, only return entries for this domain
 */
export function discoverDomainDefaults(
  domainFilter?: string,
): DomainDefaults[] {
  const devtoolsRoot = resolveDevtoolsRoot({
    cwd: process.cwd(),
    moduleDir: __dirname,
  });
  if (!devtoolsRoot) return [];

  const results: DomainDefaults[] = [];

  // Scan top-level domain dirs in devtools/
  const entries = safeReaddir(devtoolsRoot);

  for (const entry of entries) {
    const domainDir = path.join(devtoolsRoot, entry);
    if (!fs.statSync(domainDir).isDirectory()) continue;

    // Skip non-domain dirs
    if (entry === 'node_modules' || entry.startsWith('.')) continue;

    // Check for <domain>/config/defaults/
    const configDefaultsDir = path.join(domainDir, 'config', 'defaults');
    if (fs.existsSync(configDefaultsDir)) {
      if (!domainFilter || domainFilter === entry) {
        results.push({ domain: entry, defaultsDir: configDefaultsDir });
      }
    }
  }

  return results;
}

function safeReaddir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}
