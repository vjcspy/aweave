import {
  ContentType,
  MCPContent,
  MCPResponse,
  output,
  getServerStatus,
} from '@aweave/cli-shared';
import { Command, Flags } from '@oclif/core';

export class ServerStatus extends Command {
  static description = 'Show aweave server status';

  static flags = {
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerStatus);

    const status = await getServerStatus();

    const data: Record<string, unknown> = {
      status: status.running ? (status.healthy ? 'running' : 'unhealthy') : 'stopped',
    };

    if (status.state) {
      data.pid = status.state.pid;
      data.port = status.state.port;
      data.started_at = status.state.startedAt;
      data.version = status.state.version;

      // Calculate uptime
      const uptimeMs = Date.now() - new Date(status.state.startedAt).getTime();
      const uptimeSec = Math.floor(uptimeMs / 1000);
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = uptimeSec % 60;
      data.uptime = `${hours}h ${mins}m ${secs}s`;
    }

    output(
      new MCPResponse({
        success: true,
        content: [new MCPContent({ type: ContentType.JSON, data })],
      }),
      flags.format,
    );
  }
}
