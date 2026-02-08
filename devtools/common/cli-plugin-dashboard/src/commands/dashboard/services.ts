/**
 * aw dashboard services — PM2 processes + health checks.
 *
 * Standalone panel: renders ServicesPanel only (no tab nav).
 * Supports --format json for non-interactive output.
 * Supports --watch for continuous refresh.
 */

import { Command, Flags } from '@oclif/core';

import { checkAllEndpoints, DEFAULT_ENDPOINTS } from '../../lib/health.js';
import { formatBytes, formatUptime, getPm2Processes } from '../../lib/pm2.js';

export class DashboardServices extends Command {
  static description = 'Show PM2 processes and health check status';

  static flags = {
    watch: Flags.boolean({
      description: 'Continuously refresh',
      default: false,
    }),
    format: Flags.string({
      description: 'Output format',
      options: ['json'],
    }),
    'refresh-interval': Flags.integer({
      description: 'Refresh interval in seconds (with --watch)',
      default: 5,
    }),
  };

  async run() {
    const { flags } = await this.parse(DashboardServices);

    if (flags.format === 'json') {
      await this.outputJson(flags.watch, flags['refresh-interval']);
      return;
    }

    // Interactive Ink rendering
    const { render } = await import('ink');
    const React = await import('react');
    const { ServicesPanel } = await import(
      '../../components/panels/ServicesPanel.js'
    );

    const intervalMs = flags['refresh-interval'] * 1000;

    const instance = render(
      React.createElement(ServicesPanel, {
        refreshInterval: intervalMs,
      }),
    );

    if (!flags.watch) {
      // One-shot: wait a tick for data, then exit
      setTimeout(() => {
        instance.unmount();
      }, 6000);
    }
  }

  private async outputJson(watch: boolean, intervalSec: number): Promise<void> {
    const collectData = async () => {
      const [pm2, health] = await Promise.all([
        getPm2Processes(),
        checkAllEndpoints(DEFAULT_ENDPOINTS),
      ]);

      const data = {
        timestamp: new Date().toISOString(),
        processes: pm2.processes.map((p) => ({
          name: p.name,
          status: p.status,
          cpu: p.cpu,
          memory: formatBytes(p.memory),
          uptime: formatUptime(p.uptime),
        })),
        stale: pm2.stale,
        health: health.map((h) => ({
          name: h.name,
          url: h.url,
          healthy: h.healthy,
          latencyMs: h.latencyMs,
        })),
      };

      this.log(JSON.stringify(data));
    };

    await collectData();

    if (watch) {
      const interval = setInterval(() => {
        void collectData();
      }, intervalSec * 1000);

      // Keep alive until SIGINT
      process.on('SIGINT', () => {
        clearInterval(interval);
        process.exit(0);
      });

      // Block forever
      await new Promise(() => {});
    }
  }
}
