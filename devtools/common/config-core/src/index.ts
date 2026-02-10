// ---------------------------------------------------------------------------
// @aweave/config-core — Centralized config management
// ---------------------------------------------------------------------------

// Path resolution
export { getConfigRoot, getDomainConfigDir, getUserConfigPath } from './paths';

// Config loading
export { deepMerge, loadConfig } from './loader';

// Sync defaults → user config dir
export { listDefaultConfigs, syncDefaultConfigs } from './sync';

// Legacy migration
export { migrateFromLegacy } from './migrate';

// Schema validation
export { validateConfig } from './schema';

// Next.js client projection
export { projectClientConfig } from './projection';

// Types & errors
export type {
  ConfigFile,
  ConfigSchema,
  LoadConfigOptions,
  MigrateOptions,
  MigrateResult,
  SchemaField,
  SyncOptions,
  SyncResult,
  ValidationIssue,
} from './types';
export {
  ConfigDefaultsMissingError,
  ConfigParseError,
  ConfigValidationError,
} from './types';
