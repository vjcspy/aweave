import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

import { getConfigPath, saveConfig } from '../../../lib/config';
import { log } from '../../../lib/logger';

export class RelayConfigSet extends Command {
  static description = 'Set relay configuration values';

  static flags = {
    'relay-url': Flags.string({ description: 'Vercel relay URL' }),
    'api-key': Flags.string({ description: 'Relay API key' }),
    'server-key-id': Flags.string({
      description: 'Pinned server transport key ID (kid) for v2 encryption',
    }),
    'server-public-key': Flags.string({
      description: 'Pinned server public key (SPKI PEM) for v2 encryption',
    }),
    'server-public-key-fingerprint': Flags.string({
      description: 'Pinned server public key fingerprint (sha256:...)',
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
    if (flags['server-key-id']) updates.serverKeyId = flags['server-key-id'];
    if (flags['server-public-key']) {
      updates.serverPublicKey = flags['server-public-key'];
    }
    if (flags['server-public-key-fingerprint']) {
      updates.serverPublicKeyFingerprint =
        flags['server-public-key-fingerprint'];
    }
    if (flags['chunk-size'] != null) updates.chunkSize = flags['chunk-size'];
    if (flags['base-branch']) updates.defaultBaseBranch = flags['base-branch'];

    if (Object.keys(updates).length === 0) {
      this.log('No values provided. Use --help to see available options.');
      return;
    }

    saveConfig(updates);
    log.info({ keys: Object.keys(updates) }, 'relay config set: updated');

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              updated: Object.keys(updates),
              configPath: getConfigPath(),
              transportMode: 'v2',
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
