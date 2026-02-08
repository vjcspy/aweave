import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import { getConfigPath, loadConfig } from '../../../lib/config';

export class RelayConfigShow extends Command {
  static description =
    'Display current relay configuration (sensitive values masked)';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(RelayConfigShow);
    const config = loadConfig();

    // Mask sensitive values
    const masked = {
      relayUrl: config.relayUrl || '(not set)',
      apiKey: config.apiKey ? maskValue(config.apiKey) : '(not set)',
      encryptionKey: config.encryptionKey
        ? maskValue(config.encryptionKey)
        : '(not set)',
      chunkSize: config.chunkSize || 3_145_728,
      defaultBaseBranch: config.defaultBaseBranch || 'main',
      configPath: getConfigPath(),
    };

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: masked,
          }),
        ],
        metadata: {
          resource_type: 'relay_config',
          message: 'Current relay configuration',
        },
      }),
      flags.format,
    );
  }
}

/** Show first 4 and last 4 chars, mask the rest */
function maskValue(value: string): string {
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
