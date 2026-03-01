import {
  ContentType,
  FORWARDER_DEFAULTS,
  MCPContent,
  MCPResponse,
  output,
  startForwarder,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

import { log } from '../../../lib/logger';

export class ServerForwardStart extends Command {
  static description =
    'Start a TCP forwarder (listen-port -> target-port) as a background process';

  static flags = {
    'listen-port': Flags.integer({
      description: 'Port to listen on',
      default: FORWARDER_DEFAULTS.listenPort,
    }),
    'listen-host': Flags.string({
      description: 'Host to bind the listener',
      default: FORWARDER_DEFAULTS.listenHost,
    }),
    'target-port': Flags.integer({
      description: 'Upstream target port',
      default: FORWARDER_DEFAULTS.targetPort,
    }),
    'target-host': Flags.string({
      description: 'Upstream target host',
      default: FORWARDER_DEFAULTS.targetHost,
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(ServerForwardStart);

    log.info(
      {
        listenHost: flags['listen-host'],
        listenPort: flags['listen-port'],
        targetHost: flags['target-host'],
        targetPort: flags['target-port'],
      },
      'server forward start: initiating',
    );

    const result = await startForwarder({
      listenHost: flags['listen-host'],
      listenPort: flags['listen-port'],
      targetHost: flags['target-host'],
      targetPort: flags['target-port'],
    });

    if (result.success) {
      log.info({ pid: result.state?.pid }, 'server forward start: success');
    } else {
      log.error({ message: result.message }, 'server forward start: failed');
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
                listen_host: result.state.listenHost,
                listen_port: result.state.listenPort,
                target_host: result.state.targetHost,
                target_port: result.state.targetPort,
                started_at: result.state.startedAt,
                log_file: result.log_file,
                state_file: result.state_file,
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
