// Re-export playwright-core API
export { chromium, firefox, webkit, devices } from 'playwright-core';
export type {
  Browser,
  BrowserContext,
  BrowserType,
  Page,
  LaunchOptions,
} from 'playwright-core';

// Helpers
export {
  launchBrowser,
  launchPersistentBrowser,
  type LaunchBrowserOptions,
  type LaunchPersistentBrowserOptions,
  type PersistentBrowserSession,
} from './browser';
