import {
  ContentType,
  FORWARDER_DEFAULTS,
  getForwarderStatus,
  listForwarders,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

export class ServerForwardStatus extends Command {
  static description = 'Show status of TCP forwarder(s)';

  static flags = {
    'listen-port': Flags.integer({
      description: 'Listen port of the forwarder to query (omit to list all)',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerForwardStatus);

    let data: Record<string, unknown>;

    if (flags['listen-port'] !== undefined) {
      data = getForwarderStatus(flags['listen-port']) as unknown as Record<
        string,
        unknown
      >;
    } else {
      const all = listForwarders();
      // If no forwarder state files exist, return the default port status
      const arr =
        all.length > 0
          ? all
          : [getForwarderStatus(FORWARDER_DEFAULTS.listenPort)];
      data = { items: arr };
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
