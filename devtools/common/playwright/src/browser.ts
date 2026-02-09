import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

export interface LaunchBrowserOptions {
  /** System browser channel (e.g. 'chrome', 'msedge') */
  channel?: 'chrome' | 'msedge';
  /** Whether to run in headless mode. Default: false */
  headless?: boolean;
  /** Disable CORS by adding --disable-web-security and related flags. Default: false */
  disableCors?: boolean;
  /** Extra Chromium args to pass to the browser */
  args?: string[];
}

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

/**
 * Launch a Chromium-based browser with sensible defaults.
 *
 * Returns a BrowserSession with browser, context, page, and a close() helper.
 */
export async function launchBrowser(
  options: LaunchBrowserOptions = {},
): Promise<BrowserSession> {
  const {
    channel,
    headless = false,
    disableCors = false,
    args: extraArgs = [],
  } = options;

  const args = [...extraArgs];

  if (disableCors) {
    args.push(
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
    );
  }

  const browser = await chromium.launch({
    channel,
    headless,
    args: args.length > 0 ? args : undefined,
  });

  const context = await browser.newContext({
    bypassCSP: disableCors,
  });

  const page = await context.newPage();

  const close = async () => {
    await context.close();
    await browser.close();
  };

  return { browser, context, page, close };
}
