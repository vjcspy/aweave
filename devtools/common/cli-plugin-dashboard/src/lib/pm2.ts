/**
 * Async pm2 utilities for dashboard.
 *
 * CRITICAL: All calls use async execFile/spawn — NEVER execSync.
 * Synchronous calls block the Node event loop and freeze Ink rendering.
 */

import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface Pm2Process {
  name: string;
  pid: number;
  status: 'online' | 'stopped' | 'errored' | 'launching' | string;
  cpu: number;
  memory: number;
  uptime: number | null;
  restarts: number;
}

interface Pm2RawProcess {
  name?: string;
  pid?: number;
  pm2_env?: {
    status?: string;
    pm_uptime?: number;
    restart_time?: number;
  };
  monit?: {
    cpu?: number;
    memory?: number;
  };
}

const PM2_TIMEOUT = 10_000;

/**
 * Fetch pm2 process list asynchronously.
 * Returns typed array or empty array on error.
 */
export async function getPm2Processes(): Promise<{
  processes: Pm2Process[];
  stale: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    const child = execFile(
      'pm2',
      ['jlist'],
      { timeout: PM2_TIMEOUT, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          resolve({
            processes: [],
            stale: true,
            error: err.code === 'ENOENT' ? 'pm2 not found' : err.message,
          });
          return;
        }

        try {
          const raw = JSON.parse(stdout) as Pm2RawProcess[];
          const processes: Pm2Process[] = raw.map((proc) => ({
            name: proc.name ?? 'unknown',
            pid: proc.pid ?? 0,
            status: proc.pm2_env?.status ?? 'unknown',
            cpu: proc.monit?.cpu ?? 0,
            memory: proc.monit?.memory ?? 0,
            uptime: proc.pm2_env?.pm_uptime ?? null,
            restarts: proc.pm2_env?.restart_time ?? 0,
          }));
          resolve({ processes, stale: false });
        } catch {
          resolve({
            processes: [],
            stale: true,
            error: 'Failed to parse pm2 output',
          });
        }
      },
    );

    // Safety: kill child if it hangs beyond timeout
    setTimeout(() => child.kill('SIGTERM'), PM2_TIMEOUT + 1000);
  });
}

/**
 * Format uptime from pm2_env.pm_uptime (epoch ms) to human-readable string.
 */
export function formatUptime(pmUptime: number | null): string {
  if (pmUptime === null) return '—';
  const diff = Date.now() - pmUptime;
  if (diff < 0) return '—';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

export interface LogLine {
  timestamp: Date;
  service: string;
  message: string;
}

/**
 * Create a long-lived pm2 log stream.
 *
 * Spawns `pm2 logs --raw` and emits 'line' events.
 * MUST call .stop() on unmount to prevent leaked subprocesses.
 */
export function createPm2LogStream(serviceName?: string): {
  emitter: EventEmitter;
  stop: () => void;
  process: ChildProcess | null;
} {
  const emitter = new EventEmitter();
  const args = ['logs', '--raw'];
  if (serviceName) args.push(serviceName);

  let child: ChildProcess | null = null;

  try {
    child = spawn('pm2', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const handleData = (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        emitter.emit('line', {
          timestamp: new Date(),
          service: serviceName ?? 'all',
          message: line,
        } satisfies LogLine);
      }
    };

    child.stdout?.on('data', handleData);
    child.stderr?.on('data', handleData);

    child.on('error', (err) => {
      emitter.emit('error', err);
    });

    child.on('close', () => {
      emitter.emit('close');
    });
  } catch {
    emitter.emit('error', new Error('Failed to spawn pm2 logs'));
  }

  return {
    emitter,
    stop: () => {
      if (child && !child.killed) {
        child.kill('SIGTERM');
      }
    },
    process: child,
  };
}
