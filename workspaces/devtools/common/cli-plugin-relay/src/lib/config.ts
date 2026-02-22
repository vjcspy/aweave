import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CONFIG_DIR = path.join(os.homedir(), '.aweave');
const CONFIG_FILE = path.join(CONFIG_DIR, 'relay.json');

export interface RelayConfig {
  relayUrl?: string;
  apiKey?: string;
  transportMode?: RelayTransportMode;
  encryptionKey?: string;
  serverKeyId?: string;
  serverPublicKey?: string;
  serverPublicKeyFingerprint?: string;
  chunkSize?: number;
  defaultBaseBranch?: string;
}

export type RelayTransportMode = 'auto' | 'v1' | 'v2';

export interface ValidateConfigOptions {
  requireTransport?: boolean;
}

/** Load relay config from ~/.aweave/relay.json. Returns empty object if not found. */
export function loadConfig(): RelayConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as RelayConfig;
  } catch {
    return {};
  }
}

/** Save relay config to ~/.aweave/relay.json. Merges with existing config. */
export function saveConfig(updates: Partial<RelayConfig>): RelayConfig {
  const existing = loadConfig();
  const merged = { ...existing, ...updates };

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify(merged, null, 2) + '\n',
    'utf-8',
  );

  return merged;
}

/** Get config file path for display */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Validate that required config fields are present.
 * Returns array of missing field names.
 */
export function validateRequiredConfig(
  config: RelayConfig,
  options: ValidateConfigOptions = {},
): string[] {
  const { requireTransport = true } = options;
  const missing: string[] = [];
  if (!config.relayUrl) missing.push('relayUrl');
  if (!config.apiKey) missing.push('apiKey');

  if (!requireTransport) {
    return missing;
  }

  const effectiveMode = getEffectiveTransportMode(config);
  if (effectiveMode === 'v2') {
    if (!config.serverKeyId) missing.push('serverKeyId');
    if (!config.serverPublicKey) missing.push('serverPublicKey');
  } else if (!config.encryptionKey) {
    missing.push('encryptionKey');
  }

  return missing;
}

export function getEffectiveTransportMode(
  config: RelayConfig,
): Exclude<RelayTransportMode, 'auto'> {
  if (config.transportMode === 'v1' || config.transportMode === 'v2') {
    return config.transportMode;
  }

  if (config.serverKeyId && config.serverPublicKey) {
    return 'v2';
  }

  return 'v1';
}
