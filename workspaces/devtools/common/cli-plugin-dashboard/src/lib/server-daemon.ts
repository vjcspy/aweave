/**
 * Native server daemon status utilities for dashboard.
 *
 * Reads daemon lifecycle status via @hod/aweave-cli-shared process-manager API
 * (ESM -> CJS interop using createRequire).
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cliShared = require('@hod/aweave-cli-shared') as {
  getServerStatus: () => Promise<CliSharedServerStatus>;
};

const { getServerStatus } = cliShared;

interface CliSharedServerState {
  pid: number;
  port: number;
  startedAt: string;
  version: string;
}

interface CliSharedServerStatus {
  running: boolean;
  healthy: boolean;
  state: CliSharedServerState | null;
}

export interface DashboardService {
  name: string;
  runtimeStatus: 'running' | 'stopped';
  healthy: boolean;
  pid: number | null;
  port: number | null;
  startedAt: string | null;
  version: string | null;
  uptimeMs: number | null;
}

export async function getDashboardServices(): Promise<{
  services: DashboardService[];
  stale: boolean;
  error?: string;
}> {
  try {
    const status = await getServerStatus();
    return {
      services: [mapServerStatusToDashboardService(status)],
      stale: false,
    };
  } catch (error) {
    return {
      services: [
        {
          name: 'aweave-server',
          runtimeStatus: 'stopped',
          healthy: false,
          pid: null,
          port: null,
          startedAt: null,
          version: null,
          uptimeMs: null,
        },
      ],
      stale: true,
      error:
        error instanceof Error ? error.message : 'Failed to read daemon status',
    };
  }
}

export function formatUptimeMs(uptimeMs: number | null): string {
  if (uptimeMs === null || uptimeMs < 0) return '-';

  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function mapServerStatusToDashboardService(
  status: CliSharedServerStatus,
): DashboardService {
  if (!status.state || !status.running) {
    return {
      name: 'aweave-server',
      runtimeStatus: 'stopped',
      healthy: false,
      pid: null,
      port: null,
      startedAt: null,
      version: null,
      uptimeMs: null,
    };
  }

  return {
    name: 'aweave-server',
    runtimeStatus: 'running',
    healthy: status.healthy,
    pid: status.state.pid,
    port: status.state.port,
    startedAt: status.state.startedAt,
    version: status.state.version,
    uptimeMs: parseUptimeMs(status.state.startedAt),
  };
}

function parseUptimeMs(startedAt: string): number | null {
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return null;
  return Date.now() - started.getTime();
}
