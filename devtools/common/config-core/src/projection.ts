import type { ConfigFile } from './types';

// ---------------------------------------------------------------------------
// Next.js client projection
// ---------------------------------------------------------------------------

/**
 * Extract only `clientPublic` keys from a config object.
 *
 * This enforces the projection contract: only values explicitly placed
 * under `clientPublic` are safe to expose to the browser. Server-only
 * values (`server`, and any other top-level keys) are stripped.
 *
 * Usage (Next.js server component or API route):
 * ```ts
 * const config = loadConfig({ domain: 'common', name: 'debate-web', defaultsDir });
 * const clientConfig = projectClientConfig(config);
 * // Pass clientConfig to client components — never the full config
 * ```
 */
export function projectClientConfig<T extends ConfigFile>(
  config: T,
): Record<string, unknown> {
  return config.clientPublic ?? {};
}
