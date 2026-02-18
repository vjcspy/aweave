// ---------------------------------------------------------------------------
// Legacy config migration map
// ---------------------------------------------------------------------------

interface LegacyConfigEntry {
  domain: string;
  legacyFiles: Record<string, string>;
}

/**
 * Registry of known legacy config files and their target names.
 *
 * Format: { legacyPath: newConfigName }
 *   - legacyPath: absolute or ~/ path to the old config file
 *   - newConfigName: name (without extension) for the new YAML file
 *
 * Add entries here as legacy config files are identified.
 */
export const LEGACY_CONFIG_MAP: LegacyConfigEntry[] = [
  // Example: uncomment and customize when legacy files are identified
  // {
  //   domain: 'common',
  //   legacyFiles: {
  //     '~/.aweave/relay.json': 'relay',
  //   },
  // },
];
