import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { getUserConfigPath } from './paths';
import {
  ConfigDefaultsMissingError,
  type ConfigFile,
  ConfigParseError,
  type LoadConfigOptions,
} from './types';

// ---------------------------------------------------------------------------
// Config loading with deep-merge + env var override
// ---------------------------------------------------------------------------

/**
 * Load a config by merging: defaults → user override → env vars.
 *
 * Precedence (highest to lowest):
 *   1. Environment variables
 *   2. User config file (`~/.aweave/config/<domain>/<name>.yaml`)
 *   3. Default config file (in-source `defaults/<name>.yaml`)
 *
 * If the user config file does not exist, only defaults + env vars are used (no error).
 * If the defaults file does not exist, `ConfigDefaultsMissingError` is thrown.
 */
export function loadConfig<T extends ConfigFile = ConfigFile>(
  options: LoadConfigOptions,
): T {
  const { domain, name, defaultsDir, envOverrides } = options;

  // 1. Load defaults (required)
  const defaultConfig = loadDefaultConfig(defaultsDir, name);

  // 2. Load user override (optional — fallback to empty)
  const userConfigPath = getUserConfigPath(domain, name);
  const userConfig = loadYamlFile(userConfigPath, false);

  // 3. Deep-merge: defaults ← user override
  const merged = deepMerge(defaultConfig, userConfig);

  // 4. Apply env var overrides
  if (envOverrides) {
    applyEnvOverrides(merged, envOverrides);
  }

  return merged as T;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadDefaultConfig(
  defaultsDir: string,
  name: string,
): Record<string, unknown> {
  if (!fs.existsSync(defaultsDir)) {
    throw new ConfigDefaultsMissingError(defaultsDir);
  }

  const filePath = path.join(defaultsDir, `${name}.yaml`);
  return loadYamlFile(filePath, true);
}

/**
 * Parse a YAML file and return its contents as a plain object.
 * @param filePath  Absolute path to the YAML file
 * @param required  If true, throw ConfigParseError when file is missing
 */
function loadYamlFile(
  filePath: string,
  required: boolean,
): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    if (required) {
      throw new ConfigParseError(filePath, new Error('File does not exist'));
    }
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf-8');

  // Empty file → empty config
  if (raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = YAML.parse(raw);

    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(
        'Config file must contain a YAML mapping (object) at top level',
      );
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof YAML.YAMLParseError) {
      const pos = error.linePos?.[0];
      throw new ConfigParseError(filePath, error, pos?.line, pos?.col);
    }
    throw new ConfigParseError(
      filePath,
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

/**
 * Deep-merge two objects.
 * Rules:
 *   - Objects: deep merge (target keys overridden by source recursively)
 *   - Arrays: **replace** (source array replaces target array entirely)
 *   - Scalar: override
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Apply environment variable overrides using dot-notation paths.
 * E.g. envOverrides = { "server.port": "SERVER_PORT" }
 * If SERVER_PORT is set, it will override config.server.port.
 *
 * Values are coerced: "true"/"false" → boolean, numeric strings → number.
 */
function applyEnvOverrides(
  config: Record<string, unknown>,
  overrides: Record<string, string>,
): void {
  for (const [dotPath, envVar] of Object.entries(overrides)) {
    const envValue = process.env[envVar];
    if (envValue === undefined) continue;

    const keys = dotPath.split('.');
    let current: Record<string, unknown> = config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!isPlainObject(current[key])) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = coerceValue(envValue);
  }
}

function coerceValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;

  const num = Number(value);
  if (!Number.isNaN(num) && value.trim().length > 0) return num;

  return value;
}
