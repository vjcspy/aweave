import { Command } from '@oclif/core';

import { log } from '../../lib/logger.js';

export class DashboardOpen extends Command {
  static description =
    'Open the dashboard web application in the default browser';

  async run() {
    const { default: openBrowser } = await import('open');

    const url = 'http://localhost:3456/dashboard';
    log.info({ url }, 'dashboard open: opening browser');
    this.log(`Opening dashboard in browser: ${url}`);

    await openBrowser(url);
  }
}
