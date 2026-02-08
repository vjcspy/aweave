/**
 * aw dashboard system — CPU, memory, disk, versions.
 *
 * Standalone panel: renders SystemPanel only.
 * Supports --format json for non-interactive output.
 * Supports --watch for continuous refresh.
 */

import { Command, Flags } from '@oclif/core';

import {
  getCpuUsage,
  getDiskUsage,
  getMemoryUsage,
  getVersionInfo,
} from '../../lib/system.js';

export class DashboardSystem extends Command {
  static description = 'Show system resource usage and environment info';

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
      default: 2,
    }),
  };

  async run() {
    const { flags } = await this.parse(DashboardSystem);

    if (flags.format === 'json') {
      await this.outputJson(flags.watch, flags['refresh-interval']);
      return;
    }

    // Interactive Ink rendering
    const { render } = await import('ink');
    const React = await import('react');
    const { SystemPanel } = await import(
      '../../components/panels/SystemPanel.js'
    );

    const instance = render(React.createElement(SystemPanel));

    if (!flags.watch) {
      setTimeout(() => {
        instance.unmount();
      }, 4000);
    }
  }

  private async outputJson(watch: boolean, intervalSec: number): Promise<void> {
    // Take initial CPU snapshot
    getCpuUsage();
    // Wait one tick for delta
    await new Promise((r) => setTimeout(r, 1000));

    const collectData = async () => {
      const [disk, versions] = await Promise.all([
        getDiskUsage(),
        getVersionInfo(),
      ]);

      const data = {
        timestamp: new Date().toISOString(),
        cpu: getCpuUsage(),
        memory: getMemoryUsage(),
        disk,
        versions,
      };

      this.log(JSON.stringify(data));
    };

    await collectData();

    if (watch) {
      const interval = setInterval(() => {
        void collectData();
      }, intervalSec * 1000);

      process.on('SIGINT', () => {
        clearInterval(interval);
        process.exit(0);
      });

      await new Promise(() => {});
    }
  }
}
