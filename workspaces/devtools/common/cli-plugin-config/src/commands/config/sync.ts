import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { log } from '../../lib/logger';
import {
  ConfigDefaultsMissingError,
  getConfigRoot,
  syncDefaultConfigs,
  type SyncResult,
} from '@hod/aweave-config-core';
import { Command, Flags } from '@oclif/core';

import { discoverDomainDefaults } from '../../lib/discovery';

export class ConfigSync extends Command {
  static description =
    'Sync default config files to user config directory (~/.aweave/config/)';

  static examples = [
    '<%= config.bin %> config sync',
    '<%= config.bin %> config sync --domain common',
    '<%= config.bin %> config sync --force',
  ];

  static flags = {
    domain: Flags.string({
      description: 'Sync only a specific domain (e.g. "common", "nab")',
    }),
    force: Flags.boolean({
      default: false,
      description: 'Overwrite existing user config files',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ConfigSync);

    log.info(
      { domain: flags.domain, force: flags.force },
      'config sync: initiating',
    );

    try {
      const domains = discoverDomainDefaults(flags.domain);

      if (domains.length === 0) {
        const msg = flags.domain
          ? `No config defaults found for domain "${flags.domain}"`
          : 'No config defaults found in any domain';
        log.warn({ domain: flags.domain }, msg);
        output(
          new MCPResponse({
            success: true,
            content: [
              new MCPContent({
                type: ContentType.JSON,
                data: {
                  message: msg,
                  configRoot: getConfigRoot(),
                  results: [],
                },
              }),
            ],
          }),
          flags.format,
        );
        return;
      }

      const allResults: Array<SyncResult & { domain: string }> = [];

      for (const { domain, defaultsDir } of domains) {
        log.debug({ domain, defaultsDir }, 'config sync: syncing domain');
        const results = syncDefaultConfigs({
          domain,
          defaultsDir,
          force: flags.force,
        });
        for (const r of results) {
          allResults.push({ ...r, domain });
        }
      }

      log.info(
        { count: allResults.length, force: flags.force },
        'config sync: complete',
      );

      output(
        new MCPResponse({
          success: true,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: {
                message: `Synced config defaults${flags.force ? ' (force mode)' : ''}`,
                configRoot: getConfigRoot(),
                results: allResults,
              },
            }),
          ],
          metadata: { resource_type: 'config_sync' },
        }),
        flags.format,
      );
    } catch (error) {
      log.error({ err: error }, 'config sync: error');
      if (error instanceof ConfigDefaultsMissingError) {
        output(
          errorResponse(
            'DEFAULTS_MISSING',
            error.message,
            'Verify that the config defaults directory exists in the source',
          ),
          flags.format,
        );
        return;
      }
      throw error;
    }
  }
}
