import { randomBytes } from 'node:crypto';

import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

export class RelayConfigGenerateKey extends Command {
  static description = 'Generate a random AES-256 encryption key (base64 encoded)';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(RelayConfigGenerateKey);

    const key = randomBytes(32).toString('base64');

    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              key,
              usage: 'Use this key in both CLI config (aw relay config set --encryption-key) and server .env (ENCRYPTION_KEY)',
            },
          }),
        ],
        metadata: {
          resource_type: 'relay_key',
          message: 'Generated AES-256 encryption key',
        },
      }),
      flags.format,
    );
  }
}
