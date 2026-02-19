import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
  stopServer,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

export class ServerStop extends Command {
  static description = 'Stop the aweave server daemon';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerStop);

    const result = await stopServer();

    output(
      new MCPResponse({
        success: result.success,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: { message: result.message },
          }),
        ],
      }),
      flags.format,
    );

    if (!result.success) this.exit(1);
  }
}
