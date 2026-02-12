// Re-export playwright-core API
export type {
  Browser,
  BrowserContext,
  BrowserType,
  LaunchOptions,
  Page,
} from 'playwright-core';
export { chromium, devices, firefox, webkit } from 'playwright-core';

// Helpers
export {
  launchBrowser,
  type LaunchBrowserOptions,
  launchPersistentBrowser,
  type LaunchPersistentBrowserOptions,
  type PersistentBrowserSession,
} from './browser';
