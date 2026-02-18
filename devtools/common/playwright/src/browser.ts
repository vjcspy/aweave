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

// ─── Persistent Browser ───────────────────────────────────────────────────────

export interface LaunchPersistentBrowserOptions {
  /** Path to user data directory for persistent browser profile.
   *  Cookies, localStorage, and session data persist across launches. */
  userDataDir: string;
  /** System browser channel (e.g. 'chrome', 'msedge') */
  channel?: 'chrome' | 'msedge';
  /** Whether to run in headless mode. Default: false */
  headless?: boolean;
  /** Disable CORS by adding --disable-web-security and related flags. Default: false */
  disableCors?: boolean;
  /** Extra Chromium args to pass to the browser */
  args?: string[];
}

export interface PersistentBrowserSession {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

/**
 * Launch a Chromium-based browser with a persistent user data directory.
 *
 * Unlike `launchBrowser()`, this persists cookies, localStorage, and session
 * data between launches — enabling SSO session reuse across CLI invocations.
 *
 * Note: Persistent context has no separate `Browser` object.
 * Calling `close()` closes the context and browser together.
 */
export async function launchPersistentBrowser(
  options: LaunchPersistentBrowserOptions,
): Promise<PersistentBrowserSession> {
  const {
    userDataDir,
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

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel,
    headless,
    args: args.length > 0 ? args : undefined,
    bypassCSP: disableCors,
  });

  // Persistent context may already have pages from previous sessions
  const page = context.pages()[0] ?? (await context.newPage());

  const close = async () => {
    await context.close();
  };

  return { context, page, close };
}
