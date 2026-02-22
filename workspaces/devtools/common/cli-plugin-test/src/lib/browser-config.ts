import {
  CLI_ENV_OVERRIDES,
  DEFAULT_CONFIG_DIR,
  DOMAIN,
} from '@hod/aweave-config-common';
import type { ConfigFile } from '@hod/aweave-config-core';
import { loadConfig } from '@hod/aweave-config-core';
import type { LaunchBrowserOptions } from '@hod/aweave-playwright';

export type BrowserChannel = NonNullable<LaunchBrowserOptions['channel']>;

interface BrowserChannelConfig {
  channel: BrowserChannel;
  displayName: string;
}

/**
 * Single source of truth for which system browser channel this plugin launches.
 *
 * Resolution order (aligned with config-core):
 * 1. `AWEAVE_CURSOR_BROWSER_CHANNEL` env var (via CLI_ENV_OVERRIDES)
 * 2. `~/.aweave/config/common/cli.yaml` -> `test.cursor.browserChannel`
 * 3. default `workspaces/devtools/common/config/defaults/cli.yaml`
 */
export const CURSOR_BROWSER: BrowserChannelConfig =
  resolveCursorBrowserConfig();

interface CommonCliConfig extends ConfigFile {
  test?: {
    cursor?: {
      browserChannel?: unknown;
    };
  };
}

function resolveCursorBrowserConfig(): BrowserChannelConfig {
  const config = loadConfig<CommonCliConfig>({
    domain: DOMAIN,
    name: 'cli',
    defaultsDir: DEFAULT_CONFIG_DIR,
    envOverrides: CLI_ENV_OVERRIDES,
  });

  const channel = normalizeBrowserChannel(config.test?.cursor?.browserChannel);

  return {
    channel,
    displayName: getBrowserDisplayName(channel),
  };
}

function normalizeBrowserChannel(value: unknown): BrowserChannel {
  return value === 'chrome' ? 'chrome' : 'msedge';
}

function getBrowserDisplayName(channel: BrowserChannel): string {
  return channel === 'chrome' ? 'Google Chrome' : 'Microsoft Edge';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isConfiguredBrowserMissingError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes(CURSOR_BROWSER.channel) &&
    (message.includes('not found') ||
      message.includes("executable doesn't exist") ||
      message.includes('cannot find'))
  );
}

export function getConfiguredBrowserMissingMessage(): string {
  return `${CURSOR_BROWSER.displayName} was not found for Playwright channel "${CURSOR_BROWSER.channel}". Install ${CURSOR_BROWSER.displayName} or use a machine with it available.`;
}
