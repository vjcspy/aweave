import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import {
  getConfigRoot,
  migrateFromLegacy,
  type MigrateResult,
} from '@aweave/config-core';
import { Command, Flags } from '@oclif/core';

import { LEGACY_CONFIG_MAP } from '../../lib/legacy';

export class ConfigMigrate extends Command {
  static description =
    'Migrate legacy config files to centralized config structure (non-destructive)';

  static examples = [
    '<%= config.bin %> config migrate',
    '<%= config.bin %> config migrate --domain common',
  ];

  static flags = {
    domain: Flags.string({
      description: 'Migrate only a specific domain (e.g. "common", "nab")',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ConfigMigrate);

    const domainFilter = flags.domain;
    const domainsToMigrate = domainFilter
      ? LEGACY_CONFIG_MAP.filter((e) => e.domain === domainFilter)
      : LEGACY_CONFIG_MAP;

    if (domainsToMigrate.length === 0) {
      const msg = domainFilter
        ? `No legacy config entries found for domain "${domainFilter}"`
        : 'No legacy config migration entries configured';
      output(
        new MCPResponse({
          success: true,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: { message: msg, configRoot: getConfigRoot(), results: [] },
            }),
          ],
        }),
        flags.format,
      );
      return;
    }

    const allResults: Array<MigrateResult & { domain: string }> = [];

    for (const { domain, legacyFiles } of domainsToMigrate) {
      const results = migrateFromLegacy({ domain, legacyFiles });
      for (const r of results) {
        allResults.push({ ...r, domain });
      }
    }

    const migrated = allResults.filter((r) => r.action === 'migrated').length;
    const skipped = allResults.filter((r) => r.action === 'skipped').length;
    const notFound = allResults.filter((r) => r.action === 'not_found').length;

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              message: `Migration complete: ${migrated} migrated, ${skipped} skipped, ${notFound} not found`,
              configRoot: getConfigRoot(),
              summary: { migrated, skipped, notFound },
              results: allResults,
            },
          }),
        ],
        metadata: { resource_type: 'config_migrate' },
      }),
      flags.format,
    );
  }
}
