import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

import { getServicesStatus } from '../../../lib/services';

export class DebateServicesStatus extends Command {
  static description = 'Check status of debate services';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(DebateServicesStatus);
    const status = getServicesStatus();
    output(
      new MCPResponse({
        success: true,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: { services: status },
          }),
        ],
      }),
      flags.format,
    );
  }
}
