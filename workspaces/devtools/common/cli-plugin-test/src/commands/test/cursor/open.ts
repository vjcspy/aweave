import { chromium } from '@hod/aweave-playwright';
import type { Browser, BrowserContext, Page } from '@hod/aweave-playwright';
import { Command } from '@oclif/core';

import { JsonSessionProvider } from '../../../lib/session-provider';

const CURSOR_DASHBOARD_URL = 'https://cursor.com/dashboard';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isChromeChannelMissingError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('chrome') &&
    (message.includes('not found') ||
      message.includes("executable doesn't exist") ||
      message.includes('cannot find'))
  );
}

export default class TestCursorOpen extends Command {
  static description = 'Open Cursor dashboard using a previously saved session';

  async run(): Promise<void> {
    const provider = new JsonSessionProvider();
    const storageState = await provider.load();

    if (!storageState) {
      this.error(
        `No saved Cursor session found at ${provider.getPath()}. Run "aw test cursor save" first.`,
        { exit: 1 },
      );
    }

    let browser: Browser;
    let context: BrowserContext;
    let page: Page;

    try {
      browser = await chromium.launch({
        channel: 'chrome',
        headless: false,
      });
    } catch (error) {
      if (isChromeChannelMissingError(error)) {
        this.error(
          'Google Chrome was not found for Playwright channel "chrome". Install Chrome or use a machine with Chrome available.',
          { exit: 1 },
        );
      }
      throw error;
    }

    try {
      context = await browser.newContext({ storageState });
      page = await context.newPage();
      await page.goto(CURSOR_DASHBOARD_URL);
    } catch (error) {
      try {
        await browser.close();
      } catch {
        // Best-effort cleanup for partial launch failures.
      }
      throw error;
    }

    this.log(`Loaded Cursor session from ${provider.getPath()}`);
    this.log('Browser is ready. Press Ctrl+C to close.');

    let closing = false;
    const cleanup = async () => {
      if (closing) {
        return;
      }

      closing = true;

      try {
        await context.close();
      } catch {
        // Ignore cleanup errors during shutdown.
      }

      try {
        await browser.close();
      } catch {
        // Browser may already be closed.
      }

      process.exit(0);
    };

    browser.on('disconnected', () => {
      void cleanup();
    });

    process.once('SIGINT', () => {
      void cleanup();
    });
    process.once('SIGTERM', () => {
      void cleanup();
    });

    await new Promise<void>(() => {});
  }
}
