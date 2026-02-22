/**
 * Hook: Workspace package scanner.
 *
 * Scans pnpm-workspace.yaml once on mount using async fs.
 * Checks if each package has dist/ (built) or .next/ directory.
 */

import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { useCallback, useEffect, useState } from 'react';

const require = createRequire(import.meta.url);
const nodeShared = require(
  '@hod/aweave-node-shared',
) as typeof import('@hod/aweave-node-shared');
const { resolveDevtoolsRoot } = nodeShared;

export interface WorkspacePackage {
  /** Package name from package.json (or folder name if no package.json) */
  name: string;
  /** Relative path from devtools root */
  path: string;
  /** Whether dist/ or .next/ exists */
  built: boolean;
}

export interface WorkspaceData {
  packages: WorkspacePackage[];
  loading: boolean;
  lastScan: Date | null;
  error?: string;
}

/**
 * Resolve devtools root using shared marker-based discovery.
 * ESM call sites pass moduleDir derived from import.meta.url.
 */
function getDevtoolsRoot(): string {
  const devtoolsRoot = resolveDevtoolsRoot({
    cwd: process.cwd(),
    moduleDir: fileURLToPath(new URL('.', import.meta.url)),
  });

  if (!devtoolsRoot) {
    throw new Error('Could not find devtools root');
  }

  return devtoolsRoot;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function scanWorkspace(
  devtoolsRoot: string,
): Promise<WorkspacePackage[]> {
  const workspaceYaml = resolve(devtoolsRoot, 'pnpm-workspace.yaml');
  const content = await readFile(workspaceYaml, 'utf-8');

  // Simple YAML parser for pnpm-workspace format (just a list under packages:)
  const packages: WorkspacePackage[] = [];
  const lines = content.split('\n');
  let inPackages = false;

  for (const line of lines) {
    if (line.trim() === 'packages:') {
      inPackages = true;
      continue;
    }
    if (inPackages && line.trim().startsWith('- ')) {
      const pkgPath = line.trim().slice(2).trim();
      const fullPath = resolve(devtoolsRoot, pkgPath);

      // Try reading package.json for the real name
      let name = pkgPath.split('/').pop() ?? pkgPath;
      try {
        const pkgJson = await readFile(
          resolve(fullPath, 'package.json'),
          'utf-8',
        );
        const parsed = JSON.parse(pkgJson) as { name?: string };
        if (parsed.name) name = parsed.name;
      } catch {
        // Use folder name as fallback
      }

      // Check for build artifacts
      const hasDistDir = await fileExists(resolve(fullPath, 'dist'));
      const hasNextDir = await fileExists(resolve(fullPath, '.next'));

      packages.push({
        name,
        path: pkgPath,
        built: hasDistDir || hasNextDir,
      });
    } else if (
      inPackages &&
      !line.trim().startsWith('-') &&
      line.trim() !== ''
    ) {
      // End of packages section
      break;
    }
  }

  return packages;
}

export function useWorkspace(): WorkspaceData {
  const [packages, setPackages] = useState<WorkspacePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [error, setError] = useState<string | undefined>();

  const scan = useCallback(async () => {
    try {
      const root = getDevtoolsRoot();
      const result = await scanWorkspace(root);
      setPackages(result);
      setLastScan(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace scan failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Scan once on mount
  useEffect(() => {
    void scan();
  }, [scan]);

  return { packages, loading, lastScan, error };
}
