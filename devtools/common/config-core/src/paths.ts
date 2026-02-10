import os from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Path resolution for config directories
// ---------------------------------------------------------------------------

const CONFIG_ROOT_DIR = '.aweave';
const CONFIG_SUB_DIR = 'config';

/**
 * Returns the root config directory for the current user.
 * Default: `~/.aweave/config`
 *
 * Respects `AWEAVE_CONFIG_ROOT` env var for overriding in tests/CI.
 */
export function getConfigRoot(): string {
  if (process.env.AWEAVE_CONFIG_ROOT) {
    return process.env.AWEAVE_CONFIG_ROOT;
  }

  return path.join(os.homedir(), CONFIG_ROOT_DIR, CONFIG_SUB_DIR);
}

/**
 * Returns the config directory for a specific domain.
 * E.g. `~/.aweave/config/common`
 */
export function getDomainConfigDir(domain: string): string {
  return path.join(getConfigRoot(), domain);
}

/**
 * Returns the full path to a user config file.
 * E.g. `~/.aweave/config/common/server.yaml`
 */
export function getUserConfigPath(domain: string, name: string): string {
  return path.join(getDomainConfigDir(domain), `${name}.yaml`);
}
