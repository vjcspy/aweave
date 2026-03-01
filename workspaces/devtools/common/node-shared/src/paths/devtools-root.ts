import fs from 'node:fs';
import path from 'node:path';

export const DEVTOOLS_ROOT_MARKER = 'pnpm-workspace.yaml';
export const DEVTOOLS_ROOT_ENV_VAR = 'AWEAVE_DEVTOOLS_ROOT';

const DEFAULT_MAX_DEPTH = 10;

export interface FindAncestorWithMarkerOptions {
  /**
   * Maximum number of ancestor checks, including the start directory.
   */
  maxDepth?: number;
}

export interface ResolveDevtoolsRootOptions {
  /**
   * Environment map used for explicit root override lookup.
   * Defaults to process.env.
   */
  env?: NodeJS.ProcessEnv;
  /**
   * Environment variable name checked first for an explicit root path.
   */
  envVarName?: string;
  /**
   * Optional process cwd-based search start. Omit to skip cwd search.
   */
  cwd?: string | null;
  /**
   * Optional module directory fallback (e.g. __dirname in CJS or derived from import.meta.url in ESM).
   */
  moduleDir?: string | null;
  /**
   * Marker file used to identify the devtools root.
   */
  markerName?: string;
  /**
   * Maximum number of ancestor checks per source.
   */
  maxDepth?: number;
}

export function findAncestorWithMarker(
  startDir: string,
  markerName: string,
  options: FindAncestorWithMarkerOptions = {},
): string | null {
  if (!startDir || !markerName) {
    return null;
  }

  let currentDir = path.resolve(startDir);
  const maxDepth = normalizeMaxDepth(options.maxDepth);

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (fs.existsSync(path.join(currentDir, markerName))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

let _cachedDevtoolsRoot: string | null | undefined;

export function resolveDevtoolsRoot(
  options: ResolveDevtoolsRootOptions = {},
): string | null {
  if (_cachedDevtoolsRoot !== undefined) {
    return _cachedDevtoolsRoot;
  }

  const markerName = options.markerName ?? DEVTOOLS_ROOT_MARKER;
  const maxDepth = normalizeMaxDepth(options.maxDepth);
  const envVarName = options.envVarName ?? DEVTOOLS_ROOT_ENV_VAR;
  const env = options.env ?? process.env;

  const envOverride = env?.[envVarName]?.trim();
  if (envOverride) {
    const rootFromEnv = findAncestorWithMarker(envOverride, markerName, {
      maxDepth,
    });
    if (rootFromEnv) {
      _cachedDevtoolsRoot = rootFromEnv;
      return rootFromEnv;
    }
  }

  if (options.cwd) {
    const rootFromCwd = findAncestorWithMarker(options.cwd, markerName, {
      maxDepth,
    });
    if (rootFromCwd) {
      _cachedDevtoolsRoot = rootFromCwd;
      return rootFromCwd;
    }
  }

  if (options.moduleDir) {
    const rootFromModuleDir = findAncestorWithMarker(
      options.moduleDir,
      markerName,
      { maxDepth },
    );
    if (rootFromModuleDir) {
      _cachedDevtoolsRoot = rootFromModuleDir;
      return rootFromModuleDir;
    }
  }

  _cachedDevtoolsRoot = null;
  return null;
}

let _cachedProjectRoot: string | null | undefined;

export function resolveProjectRootFromDevtools(
  options: ResolveDevtoolsRootOptions = {},
): string | null {
  if (_cachedProjectRoot !== undefined) {
    return _cachedProjectRoot;
  }

  const devtoolsRoot = resolveDevtoolsRoot(options);
  if (!devtoolsRoot) {
    _cachedProjectRoot = null;
    return null;
  }

  _cachedProjectRoot = path.resolve(devtoolsRoot, '..', '..');
  return _cachedProjectRoot;
}

function normalizeMaxDepth(maxDepth?: number): number {
  if (
    typeof maxDepth !== 'number' ||
    !Number.isFinite(maxDepth) ||
    maxDepth < 1
  ) {
    return DEFAULT_MAX_DEPTH;
  }

  return Math.floor(maxDepth);
}
