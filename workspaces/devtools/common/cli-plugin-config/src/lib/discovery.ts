import fs from 'node:fs';
import path from 'node:path';

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
  const devtoolsRoot = findDevtoolsRoot();
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

/**
 * Find the devtools root by traversing up from the current file location.
 * Works from both source (src/) and compiled (dist/) locations.
 */
function findDevtoolsRoot(): string | null {
  // Walk up from this file's directory to find devtools root
  // This file lives at devtools/common/cli-plugin-config/src/lib/ or dist/lib/
  let dir = __dirname;

  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'pnpm-workspace.yaml');
    if (fs.existsSync(candidate)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

function safeReaddir(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}
