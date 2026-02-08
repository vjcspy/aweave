/**
 * aw dashboard — Full interactive dashboard with tab navigation.
 *
 * Renders the complete Ink dashboard with all panels.
 * ESM dynamic import for ink (ESM-only package).
 */

import { Command, Flags } from '@oclif/core';

export class DashboardIndex extends Command {
  static description = 'Interactive terminal dashboard for AWeave devtools';

  static flags = {
    'refresh-interval': Flags.integer({
      description: 'Refresh interval in seconds',
      default: 5,
    }),
    tab: Flags.string({
      description: 'Initial tab to show',
      options: ['services', 'system', 'workspace', 'logs'],
      default: 'services',
    }),
  };

  async run() {
    const { flags } = await this.parse(DashboardIndex);

    const { render } = await import('ink');
    const React = await import('react');
    const { Dashboard } = await import('../../components/Dashboard.js');

    const tab = flags.tab as 'services' | 'system' | 'workspace' | 'logs';

    render(
      React.createElement(Dashboard, {
        refreshInterval: flags['refresh-interval'],
        initialTab: tab,
      }),
    );
  }
}
