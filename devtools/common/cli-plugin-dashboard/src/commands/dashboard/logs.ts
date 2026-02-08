/**
 * aw dashboard logs — Live PM2 log stream.
 *
 * Standalone panel: renders LogsPanel only.
 * Supports --format json for non-interactive output.
 * Supports --service to filter by pm2 service name.
 */

import { Command, Flags } from '@oclif/core';

import { createPm2LogStream } from '../../lib/pm2.js';

export class DashboardLogs extends Command {
  static description = 'Show live PM2 log stream';

  static flags = {
    lines: Flags.integer({
      description: 'Number of lines to show',
      default: 50,
    }),
    service: Flags.string({
      description: 'Filter by pm2 service name',
    }),
    format: Flags.string({
      description: 'Output format',
      options: ['json'],
    }),
  };

  async run() {
    const { flags } = await this.parse(DashboardLogs);

    if (flags.format === 'json') {
      await this.outputJson(flags.service, flags.lines);
      return;
    }

    // Interactive Ink rendering
    const { render } = await import('ink');
    const React = await import('react');
    const { LogsPanel } = await import(
      '../../components/panels/LogsPanel.js'
    );

    render(
      React.createElement(LogsPanel, {
        maxLines: flags.lines,
        serviceName: flags.service,
      }),
    );
  }

  private async outputJson(
    serviceName?: string,
    maxLines?: number,
  ): Promise<void> {
    const stream = createPm2LogStream(serviceName);
    let lineCount = 0;

    stream.emitter.on('line', (line: { timestamp: Date; service: string; message: string }) => {
      this.log(
        JSON.stringify({
          timestamp: line.timestamp.toISOString(),
          service: line.service,
          message: line.message,
        }),
      );

      lineCount++;
      if (maxLines && lineCount >= maxLines) {
        stream.stop();
        process.exit(0);
      }
    });

    stream.emitter.on('error', (err: Error) => {
      this.error(`Log stream error: ${err.message}`);
    });

    // Keep alive until SIGINT or maxLines reached
    process.on('SIGINT', () => {
      stream.stop();
      process.exit(0);
    });

    await new Promise(() => {});
  }
}
