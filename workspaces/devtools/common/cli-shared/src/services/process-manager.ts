/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Server process management — replaces PM2 for server daemon lifecycle.
 *
 * Target platforms: macOS + Linux only.
 * State file: ~/.aweave/server.json
 * Log file: NestJS server writes its own pino logs to ~/.aweave/logs/
 */

import { spawn } from 'child_process';
import {
  existsSync,
  mkdirSync,
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
const STATE_FILE = join(AWEAVE_DIR, 'server.json');

/**
 * Load server port/host from config system.
 * Falls back to hardcoded defaults if config packages are not available.
 */
function loadServerDefaults(): { port: number; host: string } {
  try {
    const {
      DEFAULT_CONFIG_DIR,
      DOMAIN,
      SERVER_ENV_OVERRIDES,
    } = require('@hod/aweave-config-common');

    const { loadConfig } = require('@hod/aweave-config-core');
    const config = loadConfig({
      domain: DOMAIN,
      name: 'server',
      defaultsDir: DEFAULT_CONFIG_DIR,
      envOverrides: SERVER_ENV_OVERRIDES,
    });
    return {
      port: (config as any).server?.port ?? 3456,
      host: (config as any).server?.host ?? '127.0.0.1',
    };
  } catch {
    // Config packages not available — use hardcoded defaults
    return { port: 3456, host: '127.0.0.1' };
  }
}

const SERVER_DEFAULTS = loadServerDefaults();
const DEFAULT_PORT = SERVER_DEFAULTS.port;
const DEFAULT_HOST = SERVER_DEFAULTS.host;
const HEALTH_TIMEOUT_MS = 10_000;
const HEALTH_POLL_MS = 500;
const STOP_TIMEOUT_MS = 5_000;

// ── Types ──

export interface ServerState {
  pid: number;
  port: number;
  startedAt: string;
  version: string;
}

export interface ServerStatus {
  running: boolean;
  healthy: boolean;
  state: ServerState | null;
}

// ── State file management ──

function ensureDirs(): void {
  mkdirSync(AWEAVE_DIR, { recursive: true });
  mkdirSync(LOGS_DIR, { recursive: true });
}

function readState(): ServerState | null {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeState(state: ServerState): void {
  ensureDirs();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function clearState(): void {
  try {
    if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
  } catch {
    // Ignore errors
  }
}

// ── Process checks ──

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // Signal 0 = just check if process exists
    return true;
  } catch {
    return false;
  }
}

async function checkHealthEndpoint(
  port: number,
  host: string = DEFAULT_HOST,
  timeout: number = 2000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(`http://${host}:${port}/health`, {
      signal: controller.signal,
    });
    return resp.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function isPortInUse(
  port: number,
  host: string = DEFAULT_HOST,
): Promise<boolean> {
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

// ── Public API ──

/**
 * Resolve the server entry point path.
 * Works both in dev (workspace) and published (node_modules) contexts.
 */
export function resolveServerEntry(): string {
  try {
    return require.resolve('@hod/aweave-server/dist/main.js');
  } catch {
    // Fallback: try relative path from this package
    const fallback = join(
      __dirname,
      '..',
      '..',
      '..',
      'server',
      'dist',
      'main.js',
    );
    if (existsSync(fallback)) return fallback;
    throw new Error(
      'Cannot find @hod/aweave-server entry point. ' +
        'Ensure the server package is built: cd devtools/common/server && pnpm build',
    );
  }
}

/**
 * Start the server as a background daemon.
 *
 * Lifecycle:
 * - Check if port is already in use → refuse
 * - Check if a healthy server is already running → refuse (idempotent)
 * - Detect stale PID file → clean up and proceed
 * - Spawn detached process with stdout/stderr redirected to log file
 * - Poll health endpoint until healthy or timeout
 */
export async function startServer(options?: {
  port?: number;
  host?: string;
  version?: string;
}): Promise<{ success: boolean; message: string; state?: ServerState }> {
  const port = options?.port ?? DEFAULT_PORT;
  const host = options?.host ?? DEFAULT_HOST;
  const version = options?.version ?? '0.1.0';

  ensureDirs();

  // Check existing state
  const existingState = readState();
  if (existingState) {
    if (isProcessAlive(existingState.pid)) {
      const healthy = await checkHealthEndpoint(existingState.port, host);
      if (healthy) {
        return {
          success: true,
          message: `Server already running (PID ${existingState.pid}, port ${existingState.port})`,
          state: existingState,
        };
      }
      // Process alive but not healthy — kill stale process
      try {
        process.kill(existingState.pid, 'SIGTERM');
      } catch {
        // Ignore
      }
    }
    // Stale PID file — clean up
    clearState();
  }

  // Check if port is in use by another process — auto-kill and proceed
  if (await isPortInUse(port, host)) {
    try {
      const killPort = require('kill-port');
      await killPort(port);
      // Wait for port to be fully released
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      return {
        success: false,
        message: `Port ${port} is already in use and could not be freed automatically.`,
      };
    }
  }

  // Resolve server entry
  let serverEntry: string;
  try {
    serverEntry = resolveServerEntry();
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : 'Cannot find server entry point',
    };
  }

  // Spawn detached process. stdout/stderr set to 'ignore' because
  // the NestJS server writes its own pino logs to ~/.aweave/logs/.
  const child = spawn('node', [serverEntry], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      SERVER_PORT: String(port),
      SERVER_HOST: host,
      NODE_ENV: 'production',
    },
  });

  child.unref();

  const pid = child.pid;
  if (!pid) {
    return { success: false, message: 'Failed to spawn server process' };
  }

  // Write state file
  const state: ServerState = {
    pid,
    port,
    startedAt: new Date().toISOString(),
    version,
  };
  writeState(state);

  // Poll health endpoint
  const startTime = Date.now();
  while (Date.now() - startTime < HEALTH_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));

    if (!isProcessAlive(pid)) {
      clearState();
      return {
        success: false,
        message: `Server process exited unexpectedly. Check logs in ${LOGS_DIR}`,
      };
    }

    if (await checkHealthEndpoint(port, host)) {
      return {
        success: true,
        message: `Server started (PID ${pid}, port ${port})`,
        state,
      };
    }
  }

  // Timeout — still try to report
  return {
    success: true,
    message: `Server started (PID ${pid}, port ${port}) — health check timed out, server may still be starting`,
    state,
  };
}

/**
 * Stop the server daemon.
 *
 * Lifecycle:
 * - Send SIGTERM → wait up to 5s → SIGKILL if needed
 * - Verify process gone → clear state file
 */
export async function stopServer(): Promise<{
  success: boolean;
  message: string;
}> {
  const state = readState();

  if (!state) {
    return { success: true, message: 'Server is not running (no state file)' };
  }

  if (!isProcessAlive(state.pid)) {
    clearState();
    return {
      success: true,
      message: 'Server was not running (stale state cleaned up)',
    };
  }

  // Send SIGTERM
  try {
    process.kill(state.pid, 'SIGTERM');
  } catch {
    clearState();
    return {
      success: true,
      message: 'Server process not found (state cleaned up)',
    };
  }

  // Wait for process to exit
  const startTime = Date.now();
  while (Date.now() - startTime < STOP_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!isProcessAlive(state.pid)) {
      clearState();
      return {
        success: true,
        message: `Server stopped (was PID ${state.pid})`,
      };
    }
  }

  // Force kill
  try {
    process.kill(state.pid, 'SIGKILL');
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch {
    // Ignore
  }

  clearState();

  if (isProcessAlive(state.pid)) {
    return {
      success: false,
      message: `Failed to stop server (PID ${state.pid})`,
    };
  }

  return {
    success: true,
    message: `Server force-stopped (was PID ${state.pid})`,
  };
}

/**
 * Get server status — checks PID alive + health endpoint.
 */
export async function getServerStatus(): Promise<ServerStatus> {
  const state = readState();

  if (!state) {
    return { running: false, healthy: false, state: null };
  }

  const running = isProcessAlive(state.pid);
  if (!running) {
    clearState();
    return { running: false, healthy: false, state: null };
  }

  const healthy = await checkHealthEndpoint(state.port);
  return { running, healthy, state };
}

/**
 * Restart the server — stop + start.
 */
export async function restartServer(options?: {
  port?: number;
  host?: string;
  version?: string;
}): Promise<{ success: boolean; message: string; state?: ServerState }> {
  const stopResult = await stopServer();
  if (!stopResult.success) {
    return { success: false, message: `Stop failed: ${stopResult.message}` };
  }

  // Brief pause to ensure port is released
  await new Promise((resolve) => setTimeout(resolve, 500));

  return startServer(options);
}

/**
 * Ensure the server is running — check status and auto-start if needed.
 *
 * Designed to be called from CLI commands that depend on the server
 * (e.g., opensearch trace, clm open). Idempotent: if the server is
 * already running and healthy, returns immediately.
 *
 * @param onLog Optional callback for progress messages (written to stderr by callers)
 * @throws Object with { code, message, suggestion } if server cannot be started
 */
export async function ensureServerRunning(
  onLog?: (msg: string) => void,
): Promise<void> {
  const log = onLog ?? (() => {});

  const status = await getServerStatus();

  if (status.running && status.healthy) {
    log(
      `Server already running (PID ${status.state!.pid}, port ${status.state!.port})`,
    );
    return;
  }

  log('Server not running. Starting automatically...');

  const result = await startServer();

  if (!result.success) {
    throw {
      code: 'SERVER_START_FAILED',
      message: `Failed to auto-start server: ${result.message}`,
      suggestion: 'Try starting manually with: aw server start',
    };
  }

  log(`  ✓ ${result.message}`);
}
