/**
 * System info utilities — CPU, memory, disk, versions.
 *
 * CPU and memory use Node.js os module (non-blocking, pure JS).
 * Disk and pnpm version use async execFile.
 */

import { execFile } from 'node:child_process';
import os from 'node:os';

// ── CPU ──────────────────────────────────────────────────────────

interface CpuSnapshot {
  idle: number;
  total: number;
}

let previousSnapshot: CpuSnapshot | null = null;

function takeCpuSnapshot(): CpuSnapshot {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

/**
 * Get CPU usage as percentage (0-100).
 * Uses delta calculation between two snapshots — first call returns 0.
 */
export function getCpuUsage(): number {
  const current = takeCpuSnapshot();
  if (!previousSnapshot) {
    previousSnapshot = current;
    return 0;
  }
  const idleDelta = current.idle - previousSnapshot.idle;
  const totalDelta = current.total - previousSnapshot.total;
  previousSnapshot = current;

  if (totalDelta === 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 100);
}

// ── Memory ───────────────────────────────────────────────────────

export interface MemoryInfo {
  /** Used memory in bytes */
  used: number;
  /** Total memory in bytes */
  total: number;
  /** Usage percentage (0-100) */
  percentage: number;
  /** Human-readable used */
  usedFormatted: string;
  /** Human-readable total */
  totalFormatted: string;
}

function formatGb(bytes: number): string {
  return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
}

export function getMemoryUsage(): MemoryInfo {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    used,
    total,
    percentage: Math.round((used / total) * 100),
    usedFormatted: formatGb(used),
    totalFormatted: formatGb(total),
  };
}

// ── Disk ─────────────────────────────────────────────────────────

export interface DiskInfo {
  /** Filesystem name */
  filesystem: string;
  /** Total size (human-readable) */
  size: string;
  /** Used size (human-readable) */
  used: string;
  /** Available (human-readable) */
  available: string;
  /** Usage percentage (0-100) */
  percentage: number;
}

const DISK_TIMEOUT = 5000;

/**
 * Get disk usage for root filesystem.
 * OS-gated: returns null on Windows.
 */
export async function getDiskUsage(): Promise<DiskInfo | null> {
  if (process.platform === 'win32') return null;

  return new Promise((resolve) => {
    execFile('df', ['-h', '/'], { timeout: DISK_TIMEOUT }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }

      try {
        const lines = stdout.trim().split('\n');
        if (lines.length < 2) {
          resolve(null);
          return;
        }

        // Parse second line (first is header)
        const parts = lines[1].split(/\s+/);
        // macOS: Filesystem Size Used Avail Capacity ...
        // Linux: Filesystem Size Used Avail Use% Mounted
        const percentStr = parts.find((p) => p.endsWith('%'));
        const percentage = percentStr ? parseInt(percentStr, 10) : 0;

        resolve({
          filesystem: parts[0] ?? 'unknown',
          size: parts[1] ?? '?',
          used: parts[2] ?? '?',
          available: parts[3] ?? '?',
          percentage: isNaN(percentage) ? 0 : percentage,
        });
      } catch {
        resolve(null);
      }
    });
  });
}

// ── Versions ─────────────────────────────────────────────────────

export interface VersionInfo {
  node: string;
  pnpm: string;
  os: string;
  arch: string;
  hostname: string;
  uptime: string;
}

const VERSION_TIMEOUT = 5000;

async function getPnpmVersion(): Promise<string> {
  return new Promise((resolve) => {
    execFile('pnpm', ['--version'], { timeout: VERSION_TIMEOUT }, (err, stdout) => {
      if (err) {
        resolve('unknown');
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function formatSystemUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '< 1m';
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const pnpm = await getPnpmVersion();
  return {
    node: process.version,
    pnpm,
    os: `${process.platform} ${os.release()} (${process.arch})`,
    arch: process.arch,
    hostname: os.hostname(),
    uptime: formatSystemUptime(os.uptime()),
  };
}
