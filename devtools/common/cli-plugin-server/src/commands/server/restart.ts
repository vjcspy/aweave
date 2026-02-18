import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
  restartServer,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

export class ServerRestart extends Command {
  static description = 'Restart the aweave server daemon';

  static flags = {
    port: Flags.integer({
      description: 'Server port',
      default: 3456,
    }),
    host: Flags.string({
      description: 'Bind address',
      default: '127.0.0.1',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerRestart);

    const result = await restartServer({
      port: flags.port,
      host: flags.host,
    });

    output(
      new MCPResponse({
        success: result.success,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data: {
              message: result.message,
              ...(result.state && {
                pid: result.state.pid,
                port: result.state.port,
                started_at: result.state.startedAt,
              }),
            },
          }),
        ],
      }),
      flags.format,
    );

    if (!result.success) this.exit(1);
  }
}
