import {
  ContentType,
  FORWARDER_DEFAULTS,
  getCliLogger,
  killForwarder,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

export class ServerForwardKill extends Command {
  static description = 'Immediately kill a TCP forwarder with SIGKILL';

  static flags = {
    'listen-port': Flags.integer({
      description: 'Listen port of the forwarder to kill',
    }),
    all: Flags.boolean({
      description: 'Kill all known forwarders',
      default: false,
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerForwardKill);
    const log = getCliLogger();

    if (!flags['listen-port'] && !flags.all) {
      this.error(
        'Provide --listen-port <port> or --all to kill all forwarders.',
        { exit: 1 },
      );
    }

    const results: Array<{ port: number; success: boolean; message: string }> =
      [];

    if (flags.all) {
      const { listForwarders } = await import('@hod/aweave-cli-shared');
      const statuses = listForwarders();
      const allPorts =
        statuses.length > 0
          ? statuses.map((s) => s.listen_port)
          : [FORWARDER_DEFAULTS.listenPort];

      for (const port of allPorts) {
        log.info({ port }, 'server forward kill: killing');
        const r = await killForwarder(port);
        results.push({ port, ...r });
      }
    } else {
      const port = flags['listen-port'] ?? FORWARDER_DEFAULTS.listenPort;
      log.info({ port }, 'server forward kill: killing');
      const r = await killForwarder(port);
      results.push({ port, ...r });
    }

    const allSuccess = results.every((r) => r.success);

    output(
      new MCPResponse({
        success: allSuccess,
        content: [
          new MCPContent({
            type: ContentType.JSON,
            data:
              results.length === 1
                ? (results[0] as Record<string, unknown>)
                : { items: results },
          }),
        ],
      }),
      flags.format,
    );

    if (!allSuccess) this.exit(1);
  }
}
