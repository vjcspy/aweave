import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

import { getConfigPath, loadConfig } from '../../../lib/config';
import { log } from '../../../lib/logger';

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
    log.debug('relay config show: displaying configuration');

    // Mask sensitive values
    const masked = {
      relayUrl: config.relayUrl || '(not set)',
      apiKey: config.apiKey ? maskValue(config.apiKey) : '(not set)',
      transportMode: 'v2',
      serverKeyId: config.serverKeyId || '(not set)',
      serverPublicKeyFingerprint:
        config.serverPublicKeyFingerprint || '(not set)',
      serverPublicKey: config.serverPublicKey
        ? summarizePem(config.serverPublicKey)
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

function summarizePem(value: string): string {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return maskValue(value);
  }

  const body = lines.slice(1, -1).join('');
  return `${lines[0]} ${maskValue(body)} ${lines.at(-1)}`;
}
