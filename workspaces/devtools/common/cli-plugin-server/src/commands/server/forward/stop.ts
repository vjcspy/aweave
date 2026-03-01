import {
  ContentType,
  FORWARDER_DEFAULTS,
  getCliLogger,
  MCPContent,
  MCPResponse,
  output,
  stopForwarder,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

export class ServerForwardStop extends Command {
  static description =
    'Stop a TCP forwarder gracefully (SIGTERM, optional SIGKILL fallback)';

  static flags = {
    'listen-port': Flags.integer({
      description: 'Listen port of the forwarder to stop',
    }),
    all: Flags.boolean({
      description: 'Stop all known forwarders',
      default: false,
    }),
    force: Flags.boolean({
      description: 'Fall back to SIGKILL after timeout',
      default: false,
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerForwardStop);
    const log = getCliLogger();

    if (!flags['listen-port'] && !flags.all) {
      this.error(
        'Provide --listen-port <port> or --all to stop all forwarders.',
        { exit: 1 },
      );
    }

    const ports: number[] = flags.all
      ? [] // resolved below via listForwarders
      : [flags['listen-port'] ?? FORWARDER_DEFAULTS.listenPort];

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
        log.info({ port }, 'server forward stop: stopping');
        const r = await stopForwarder(port, { force: flags.force });
        results.push({ port, ...r });
      }
    } else {
      for (const port of ports) {
        log.info({ port }, 'server forward stop: stopping');
        const r = await stopForwarder(port, { force: flags.force });
        results.push({ port, ...r });
      }
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
