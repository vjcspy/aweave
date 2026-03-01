/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Forwarder process management — manages lightweight Node TCP forwarders.
 *
 * Target platforms: macOS + Linux only.
 * State dir: ~/.aweave/forwarders/
 * Log files: ~/.aweave/logs/forwarder-<listen-port>.log
 *
 * Isolation rule: this manager never touches ~/.aweave/server.json
 * or any logic in process-manager.ts.
 */

import { spawn } from 'child_process';
import {
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { createConnection } from 'net';
import { homedir } from 'os';
import { join } from 'path';

// ── Constants ──

const AWEAVE_DIR = join(homedir(), '.aweave');
const LOGS_DIR = join(AWEAVE_DIR, 'logs');
const FORWARDERS_DIR = join(AWEAVE_DIR, 'forwarders');
const STOP_TIMEOUT_MS = 5_000;

// ── Config defaults ──

interface ForwarderDefaults {
  listenHost: string;
  listenPort: number;
  targetHost: string;
  targetPort: number;
}

function loadForwarderDefaults(): ForwarderDefaults {
  try {
    const {
      DEFAULT_CONFIG_DIR,
      DOMAIN,
      CLI_ENV_OVERRIDES,
    } = require('@hod/aweave-config-common');
    const { loadConfig } = require('@hod/aweave-config-core');
    const config = loadConfig({
      domain: DOMAIN,
      name: 'cli',
      defaultsDir: DEFAULT_CONFIG_DIR,
      envOverrides: CLI_ENV_OVERRIDES,
    }) as any;
    return {
      listenHost: config?.services?.forwarder?.listenHost ?? '127.0.0.1',
      listenPort: config?.services?.forwarder?.listenPort ?? 3845,
      targetHost: config?.services?.forwarder?.targetHost ?? '127.0.0.1',
      targetPort: config?.services?.forwarder?.targetPort ?? 3456,
    };
  } catch {
    // Config packages not available — use hardcoded defaults
    return {
      listenHost: '127.0.0.1',
      listenPort: 3845,
      targetHost: '127.0.0.1',
      targetPort: 3456,
    };
  }
}

export const FORWARDER_DEFAULTS = loadForwarderDefaults();

// ── Types ──

export interface ForwarderState {
  pid: number;
  listenHost: string;
  listenPort: number;
  targetHost: string;
  targetPort: number;
  startedAt: string;
  version: string;
}

export type ForwarderStatusCode = 'running' | 'stopped' | 'stale';

export interface ForwarderStatusResult {
  status: ForwarderStatusCode;
  listen_host: string;
  listen_port: number;
  target_host: string;
  target_port: number;
  pid?: number;
  started_at?: string;
  uptime?: string;
  log_file: string;
  state_file: string;
}

// ── Path helpers ──

function stateFilePath(listenPort: number): string {
  return join(FORWARDERS_DIR, `forwarder-${listenPort}.json`);
}

function logFilePath(listenPort: number): string {
  return join(LOGS_DIR, `forwarder-${listenPort}.log`);
}

// ── Dir management ──

function ensureDirs(): void {
  mkdirSync(AWEAVE_DIR, { recursive: true });
  mkdirSync(LOGS_DIR, { recursive: true });
  mkdirSync(FORWARDERS_DIR, { recursive: true });
}

// ── State management ──

function readState(listenPort: number): ForwarderState | null {
  try {
    const path = stateFilePath(listenPort);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as ForwarderState;
  } catch {
    return null;
  }
}

function writeState(state: ForwarderState): void {
  ensureDirs();
  writeFileSync(
    stateFilePath(state.listenPort),
    JSON.stringify(state, null, 2) + '\n',
  );
}

function clearState(listenPort: number): void {
  try {
    const path = stateFilePath(listenPort);
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // Ignore
  }
}

// ── Process checks ──

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// ── Worker entry resolution ──

function resolveWorkerEntry(): string {
  try {
    return require.resolve('@hod/aweave-cli-shared/dist/services/tcp-forwarder-worker.js');
  } catch {
    // Fallback: relative dev path
    const fallback = join(__dirname, 'tcp-forwarder-worker.js');
    if (existsSync(fallback)) return fallback;
    throw new Error(
      'Cannot find tcp-forwarder-worker entry point. ' +
        'Ensure the cli-shared package is built: cd devtools/common/cli-shared && pnpm build',
    );
  }
}

// ── Uptime helper ──

function formatUptime(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${m}m ${s}s`;
}

// ── Status builder ──

function buildStatus(
  state: ForwarderState | null,
  statusCode: ForwarderStatusCode,
  listenPort: number,
  listenHost?: string,
  targetHost?: string,
  targetPort?: number,
): ForwarderStatusResult {
  const lHost =
    state?.listenHost ?? listenHost ?? FORWARDER_DEFAULTS.listenHost;
  const tHost =
    state?.targetHost ?? targetHost ?? FORWARDER_DEFAULTS.targetHost;
  const tPort =
    state?.targetPort ?? targetPort ?? FORWARDER_DEFAULTS.targetPort;

  const result: ForwarderStatusResult = {
    status: statusCode,
    listen_host: lHost,
    listen_port: listenPort,
    target_host: tHost,
    target_port: tPort,
    log_file: logFilePath(listenPort),
    state_file: stateFilePath(listenPort),
  };

  if (state && statusCode === 'running') {
    result.pid = state.pid;
    result.started_at = state.startedAt;
    result.uptime = formatUptime(state.startedAt);
  }

  return result;
}

// ── Public API ──

/**
 * Start a TCP forwarder process.
 * Idempotent: if the same forwarding is already running, returns success immediately.
 */
export async function startForwarder(options?: {
  listenHost?: string;
  listenPort?: number;
  targetHost?: string;
  targetPort?: number;
  version?: string;
}): Promise<{
  success: boolean;
  message: string;
  state?: ForwarderState;
  log_file?: string;
  state_file?: string;
}> {
  const listenHost = options?.listenHost ?? FORWARDER_DEFAULTS.listenHost;
  const listenPort = options?.listenPort ?? FORWARDER_DEFAULTS.listenPort;
  const targetHost = options?.targetHost ?? FORWARDER_DEFAULTS.targetHost;
  const targetPort = options?.targetPort ?? FORWARDER_DEFAULTS.targetPort;
  const version = options?.version ?? '0.1.0';

  ensureDirs();

  // Idempotent check
  const existingState = readState(listenPort);
  if (existingState && isProcessAlive(existingState.pid)) {
    return {
      success: true,
      message: `Forwarder already running (PID ${existingState.pid}, ${listenPort} -> ${existingState.targetHost}:${existingState.targetPort})`,
      state: existingState,
      log_file: logFilePath(listenPort),
      state_file: stateFilePath(listenPort),
    };
  }

  // Clean stale state
  if (existingState) clearState(listenPort);

  // Check if port is already used by something else
  if (await isPortInUse(listenPort, listenHost)) {
    return {
      success: false,
      message: `Port ${listenPort} is already in use by an unrelated process. Choose a different --listen-port.`,
    };
  }

  // Resolve worker entry
  let workerEntry: string;
  try {
    workerEntry = resolveWorkerEntry();
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : 'Cannot find forwarder worker entry point',
    };
  }

  const logFd = openSync(logFilePath(listenPort), 'a');

  const child = spawn('node', [workerEntry], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      FORWARDER_LISTEN_HOST: listenHost,
      FORWARDER_LISTEN_PORT: String(listenPort),
      FORWARDER_TARGET_HOST: targetHost,
      FORWARDER_TARGET_PORT: String(targetPort),
    },
  });

  child.unref();

  const pid = child.pid;
  if (!pid) {
    return { success: false, message: 'Failed to spawn forwarder process' };
  }

  const state: ForwarderState = {
    pid,
    listenHost,
    listenPort,
    targetHost,
    targetPort,
    startedAt: new Date().toISOString(),
    version,
  };

  writeState(state);

  // Brief wait to detect immediate crash
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (!isProcessAlive(pid)) {
    clearState(listenPort);
    return {
      success: false,
      message: `Forwarder process exited immediately. Check logs: ${logFilePath(listenPort)}`,
    };
  }

  return {
    success: true,
    message: `Forwarder started (PID ${pid}, ${listenHost}:${listenPort} -> ${targetHost}:${targetPort})`,
    state,
    log_file: logFilePath(listenPort),
    state_file: stateFilePath(listenPort),
  };
}

/**
 * Get status for a specific forwarder by listen port.
 */
export function getForwarderStatus(listenPort: number): ForwarderStatusResult {
  const state = readState(listenPort);

  if (!state) {
    return buildStatus(null, 'stopped', listenPort);
  }

  if (!isProcessAlive(state.pid)) {
    // Stale state — do not auto-clean, just report
    return buildStatus(state, 'stale', listenPort);
  }

  return buildStatus(state, 'running', listenPort);
}

/**
 * List status for all known forwarders (reads all state files in FORWARDERS_DIR).
 */
export function listForwarders(): ForwarderStatusResult[] {
  try {
    if (!existsSync(FORWARDERS_DIR)) return [];
    const files = readdirSync(FORWARDERS_DIR).filter(
      (f) => f.startsWith('forwarder-') && f.endsWith('.json'),
    );
    return files
      .map((file) => {
        const portMatch = file.match(/forwarder-(\d+)\.json/);
        if (!portMatch) return null;
        const port = parseInt(portMatch[1]!, 10);
        return getForwarderStatus(port);
      })
      .filter((s): s is ForwarderStatusResult => s !== null);
  } catch {
    return [];
  }
}

/**
 * Stop a forwarder gracefully (SIGTERM → wait → SIGKILL if --force).
 */
export async function stopForwarder(
  listenPort: number,
  options?: { force?: boolean },
): Promise<{ success: boolean; message: string }> {
  const state = readState(listenPort);

  if (!state) {
    return {
      success: true,
      message: `No forwarder state found for port ${listenPort}`,
    };
  }

  if (!isProcessAlive(state.pid)) {
    clearState(listenPort);
    return {
      success: true,
      message: `Forwarder was not running (stale state cleaned up for port ${listenPort})`,
    };
  }

  try {
    process.kill(state.pid, 'SIGTERM');
  } catch {
    clearState(listenPort);
    return {
      success: true,
      message: `Forwarder process not found (state cleaned up for port ${listenPort})`,
    };
  }

  const startTime = Date.now();
  while (Date.now() - startTime < STOP_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!isProcessAlive(state.pid)) {
      clearState(listenPort);
      return {
        success: true,
        message: `Forwarder stopped (was PID ${state.pid})`,
      };
    }
  }

  // Timeout reached
  if (options?.force) {
    try {
      process.kill(state.pid, 'SIGKILL');
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch {
      // Ignore
    }
    clearState(listenPort);
    if (isProcessAlive(state.pid)) {
      return {
        success: false,
        message: `Failed to kill forwarder (PID ${state.pid})`,
      };
    }
    return {
      success: true,
      message: `Forwarder force-killed (was PID ${state.pid})`,
    };
  }

  return {
    success: false,
    message: `Forwarder did not stop within timeout. Try --force to SIGKILL.`,
  };
}

/**
 * Kill a forwarder immediately with SIGKILL.
 */
export async function killForwarder(
  listenPort: number,
): Promise<{ success: boolean; message: string }> {
  const state = readState(listenPort);

  if (!state) {
    return {
      success: true,
      message: `No forwarder state found for port ${listenPort}`,
    };
  }

  if (!isProcessAlive(state.pid)) {
    clearState(listenPort);
    return {
      success: true,
      message: `Forwarder was not running (stale state cleaned up for port ${listenPort})`,
    };
  }

  try {
    process.kill(state.pid, 'SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 300));
  } catch {
    // Ignore
  }

  clearState(listenPort);

  if (isProcessAlive(state.pid)) {
    return {
      success: false,
      message: `Failed to kill forwarder (PID ${state.pid})`,
    };
  }

  return { success: true, message: `Forwarder killed (was PID ${state.pid})` };
}
