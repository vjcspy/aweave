import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import { getConfigPath, saveConfig } from '../../../lib/config';

export class RelayConfigSet extends Command {
  static description = 'Set relay configuration values';

  static flags = {
    'relay-url': Flags.string({ description: 'Vercel relay URL' }),
    'api-key': Flags.string({ description: 'Relay API key' }),
    'encryption-key': Flags.string({
      description: 'AES-256 encryption key (base64)',
    }),
    'chunk-size': Flags.integer({
      description: 'Chunk size in bytes (max: 3400000)',
    }),
    'base-branch': Flags.string({ description: 'Default base branch' }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(RelayConfigSet);

    const updates: Record<string, unknown> = {};
    if (flags['relay-url']) updates.relayUrl = flags['relay-url'];
    if (flags['api-key']) updates.apiKey = flags['api-key'];
    if (flags['encryption-key'])
      updates.encryptionKey = flags['encryption-key'];
    if (flags['chunk-size'] != null) updates.chunkSize = flags['chunk-size'];
    if (flags['base-branch']) updates.defaultBaseBranch = flags['base-branch'];

    if (Object.keys(updates).length === 0) {
      this.log('No values provided. Use --help to see available options.');
      return;
    }

    saveConfig(updates);

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              updated: Object.keys(updates),
              configPath: getConfigPath(),
            },
          }),
        ],
        metadata: {
          resource_type: 'relay_config',
          message: `Updated ${Object.keys(updates).join(', ')} in ${getConfigPath()}`,
        },
      }),
      flags.format,
    );
  }
}
