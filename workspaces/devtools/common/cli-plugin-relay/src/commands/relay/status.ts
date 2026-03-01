import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Args, Command, Flags } from '@oclif/core';

import { loadConfig, validateRequiredConfig } from '../../lib/config';
import { log } from '../../lib/logger';
import { pollStatus } from '../../lib/relay-client';

export class RelayStatus extends Command {
  static description = 'Check the status of a relay push session';

  static args = {
    sessionId: Args.string({
      required: true,
      description: 'Session ID to check',
    }),
  };

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { args, flags } = await this.parse(RelayStatus);
    const config = loadConfig();
    log.debug({ sessionId: args.sessionId }, 'relay status: checking');

    const missingConfig = validateRequiredConfig(config, {
      requireTransport: false,
    });
    if (missingConfig.length > 0) {
      output(
        errorResponse(
          'INVALID_INPUT',
          `Missing relay config: ${missingConfig.join(', ')}`,
          'Run: aw relay config set --help',
        ),
        flags.format,
      );
      this.exit(4);
    }

    try {
      const result = await pollStatus(
        config.relayUrl!,
        config.apiKey!,
        args.sessionId,
        { successStates: ['pushed', 'stored'] },
      );

      const success = result.status === 'pushed' || result.status === 'stored';
      output(
        new MCPResponse({
          success,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: result as unknown as Record<string, unknown>,
            }),
          ],
          metadata: {
            resource_type: 'relay_status',
            message: result.message,
          },
        }),
        flags.format,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      output(errorResponse('NETWORK_ERROR', message), flags.format);
      this.exit(3);
    }
  }
}
