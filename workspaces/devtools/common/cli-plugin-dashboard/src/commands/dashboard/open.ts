import { Command } from '@oclif/core';

export class DashboardOpen extends Command {
  static description =
    'Open the dashboard web application in the default browser';

  async run() {
    const { default: openBrowser } = await import('open');

    const url = 'http://localhost:3456/dashboard';
    this.log(`Opening dashboard in browser: ${url}`);

    await openBrowser(url);
  }
}
