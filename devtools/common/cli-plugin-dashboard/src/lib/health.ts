/**
 * Health check utilities.
 *
 * Re-exports checkHealth from @aweave/cli-shared and extends with
 * latency measurement.
 */

import { createRequire } from 'node:module';

// ESM→CJS interop: cli-shared is CJS, this plugin is ESM.
// Use createRequire() as fallback strategy per plan Phase 1 gate.
const require = createRequire(import.meta.url);
const cliShared = require('@aweave/cli-shared') as {
  checkHealth: (url: string, timeout?: number) => Promise<boolean>;
};

const { checkHealth } = cliShared;

export { checkHealth };

export interface HealthResult {
  /** Whether the endpoint responded successfully */
  healthy: boolean;
  /** Round-trip latency in ms, null if unreachable */
  latencyMs: number | null;
}

export interface HealthEndpoint {
  /** Display name */
  name: string;
  /** Full URL to check */
  url: string;
}

/** Default endpoints to check */
export const DEFAULT_ENDPOINTS: HealthEndpoint[] = [
  { name: 'Server API', url: 'http://127.0.0.1:3456/health' },
  { name: 'Debate Web', url: 'http://127.0.0.1:3457' },
];

/**
 * Check health with latency measurement.
 */
export async function checkHealthWithLatency(
  url: string,
  timeout = 2000,
): Promise<HealthResult> {
  const start = performance.now();
  const healthy = await checkHealth(url, timeout);
  const elapsed = performance.now() - start;

  return {
    healthy,
    latencyMs: healthy ? Math.round(elapsed) : null,
  };
}

/**
 * Check all default endpoints.
 */
export async function checkAllEndpoints(
  endpoints: HealthEndpoint[] = DEFAULT_ENDPOINTS,
): Promise<Array<HealthEndpoint & HealthResult>> {
  const results = await Promise.all(
    endpoints.map(async (ep) => {
      const result = await checkHealthWithLatency(ep.url);
      return { ...ep, ...result };
    }),
  );
  return results;
}
