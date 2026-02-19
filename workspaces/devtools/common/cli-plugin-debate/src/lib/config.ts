/**
 * Debate CLI configuration.
 *
 * All values configurable via environment variables.
 * Port of Python debate/config.py with interval polling changes.
 */

/** Server URL for debate API */
export const DEBATE_SERVER_URL =
  process.env.DEBATE_SERVER_URL ?? 'http://127.0.0.1:3456';

/** Auth token (optional — if set, all requests include Bearer token) */
export const DEBATE_AUTH_TOKEN = process.env.DEBATE_AUTH_TOKEN;

/** Overall wait deadline in seconds (how long `aw debate wait` polls before giving up) */
export const DEBATE_WAIT_DEADLINE = parseInt(
  process.env.DEBATE_WAIT_DEADLINE ?? '120',
  10,
);

/** Interval between poll requests in seconds (interval polling, NOT long polling) */
export const POLL_INTERVAL = parseFloat(
  process.env.DEBATE_POLL_INTERVAL ?? '2',
);

/** Debate server port */
export const DEBATE_SERVER_PORT = parseInt(
  process.env.DEBATE_SERVER_PORT ?? '3456',
  10,
);

/** Debate web UI port */
export const DEBATE_WEB_PORT = parseInt(
  process.env.DEBATE_WEB_PORT ?? '3457',
  10,
);

/** Auto-start services when creating debate. Set DEBATE_AUTO_START=false to disable. */
export const AUTO_START_SERVICES =
  (process.env.DEBATE_AUTO_START ?? 'true').toLowerCase() === 'true';
