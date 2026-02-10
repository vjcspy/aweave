// ---------------------------------------------------------------------------
// Config types & error classes
// ---------------------------------------------------------------------------

/** Options for loadConfig() */
export interface LoadConfigOptions {
  /** Domain name (e.g. "common", "nab") — maps to sub-folder under config root */
  domain: string;
  /** Config file name without extension (e.g. "server", "cli") */
  name: string;
  /** Absolute path to the directory containing default YAML files */
  defaultsDir: string;
  /**
   * Optional map of environment variable overrides.
   * Keys use dot-notation paths (e.g. "server.port").
   * Values are env var names (e.g. "SERVER_PORT").
   */
  envOverrides?: Record<string, string>;
}

/** Options for syncDefaultConfigs() */
export interface SyncOptions {
  /** Domain name */
  domain: string;
  /** Absolute path to the defaults directory */
  defaultsDir: string;
  /** Overwrite existing user config files (default: false) */
  force?: boolean;
}

/** Result of a single file sync operation */
export interface SyncResult {
  file: string;
  action: 'created' | 'skipped' | 'overwritten';
  destination: string;
}

/** Options for migrateFromLegacy() */
export interface MigrateOptions {
  /** Domain name */
  domain: string;
  /** Map of legacy file paths to new config names */
  legacyFiles?: Record<string, string>;
}

/** Result of a single file migration */
export interface MigrateResult {
  legacyPath: string;
  newPath: string;
  action: 'migrated' | 'skipped' | 'not_found';
  message: string;
}

/** Standard config file structure */
export interface ConfigFile {
  configVersion?: number;
  server?: Record<string, unknown>;
  clientPublic?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Schema field definition for validation */
export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  description?: string;
}

/** Schema definition for a config file */
export interface ConfigSchema {
  configVersion?: number;
  fields: Record<string, SchemaField>;
}

/** Validation issue reported by validateConfig() */
export interface ValidationIssue {
  path: string;
  message: string;
  expected?: string;
  actual?: string;
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/** Thrown when a YAML config file cannot be parsed */
export class ConfigParseError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly cause: Error,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    const location =
      line != null
        ? ` at line ${line}` + (column != null ? `, column ${column}` : '')
        : '';
    super(
      `Failed to parse config file "${filePath}"${location}: ${cause.message}`,
    );
    this.name = 'ConfigParseError';
  }
}

/** Thrown when schema validation fails */
export class ConfigValidationError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly issues: ValidationIssue[],
  ) {
    const summary = issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n');
    super(`Config validation failed for "${filePath}":\n${summary}`);
    this.name = 'ConfigValidationError';
  }
}

/** Thrown when the defaults directory is missing */
export class ConfigDefaultsMissingError extends Error {
  constructor(public readonly defaultsDir: string) {
    super(`Defaults directory not found: "${defaultsDir}"`);
    this.name = 'ConfigDefaultsMissingError';
  }
}
