import { launchBrowser } from '@hod/aweave-playwright';
import { Command } from '@oclif/core';

import { JsonSessionProvider } from '../../../lib/session-provider';

const CURSOR_DASHBOARD_URL = 'https://cursor.com/dashboard';
const CURSOR_DASHBOARD_PATTERN = '**/dashboard';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isBrowserClosedError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('target page, context or browser has been closed') ||
    message.includes('browser has been closed') ||
    message.includes('target closed')
  );
}

function isEdgeChannelMissingError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('msedge') &&
    (message.includes('not found') ||
      message.includes("executable doesn't exist") ||
      message.includes('cannot find'))
  );
}

export default class TestCursorSave extends Command {
  static description =
    'Open Cursor dashboard, wait for login completion, and save browser storage state';

  async run(): Promise<void> {
    const provider = new JsonSessionProvider();

    this.log(`Opening Microsoft Edge for Cursor login...`);
    this.log(`Session file: ${provider.getPath()}`);

    let session;
    try {
      session = await launchBrowser({ channel: 'msedge', headless: false });
    } catch (error) {
      if (isEdgeChannelMissingError(error)) {
        this.error(
          'Microsoft Edge was not found for Playwright channel "msedge". Install Edge or use a machine with Edge available.',
          { exit: 1 },
        );
      }
      throw error;
    }

    let browserDisconnected = false;
    session.browser.on('disconnected', () => {
      browserDisconnected = true;
    });

    try {
      await session.page.goto(CURSOR_DASHBOARD_URL);
      this.log(
        'Complete login/SSO in the opened browser window. Waiting for Cursor dashboard...',
      );
      await session.page.waitForURL(CURSOR_DASHBOARD_PATTERN, { timeout: 0 });

      const storageState = await session.context.storageState();
      await provider.save(storageState);

      this.log(`Saved Cursor session state to ${provider.getPath()}`);
    } catch (error) {
      if (browserDisconnected || isBrowserClosedError(error)) {
        this.log(
          'Browser was closed before login completed. Session was not saved.',
        );
        this.exit(1);
      }

      throw error;
    } finally {
      try {
        await session.close();
      } catch {
        // Browser may already be closed by the user.
      }
    }
  }
}
