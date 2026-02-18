import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
  startServer,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';
import { execSync } from 'child_process';

export class ServerStart extends Command {
  static description = 'Start the aweave server as a background daemon';

  static flags = {
    port: Flags.integer({
      description: 'Server port',
      default: 3456,
    }),
    host: Flags.string({
      description: 'Bind address',
      default: '127.0.0.1',
    }),
    open: Flags.boolean({
      description: 'Open browser after start',
      default: false,
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerStart);

    const result = await startServer({
      port: flags.port,
      host: flags.host,
    });

    if (result.success && flags.open && result.state) {
      const url = `http://${flags.host}:${result.state.port}/debate`;
      try {
        // macOS: open, Linux: xdg-open
        const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
        execSync(`${cmd} ${url}`, { stdio: 'ignore' });
      } catch {
        // Ignore open errors
      }
    }

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
