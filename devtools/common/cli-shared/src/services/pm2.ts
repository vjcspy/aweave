/**
 * pm2 service management utilities.
 *
 * Shared helpers for managing services via pm2, used by domain CLIs
 * that need to auto-start backend services (e.g., debate CLI auto-starts
 * the NestJS server).
 */

import {
  execSync,
  type ExecSyncOptionsWithStringEncoding,
} from 'child_process';

const EXEC_OPTIONS: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf-8',
  timeout: 30_000,
  stdio: ['pipe', 'pipe', 'pipe'],
};

/**
 * Check if a pm2 process is online by name.
 */
export function checkPm2Process(name: string): boolean {
  try {
    const stdout = execSync('pm2 jlist', EXEC_OPTIONS);
    const processes = JSON.parse(stdout) as Array<{
      name: string;
      pm2_env?: { status?: string };
    }>;
    return processes.some(
      (proc) => proc.name === name && proc.pm2_env?.status === 'online',
    );
  } catch {
    return false;
  }
}

/**
 * Check if an HTTP endpoint is responding.
 */
export async function checkHealth(
  url: string,
  timeout = 2000,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    return resp.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a shell command synchronously. Returns [success, errorMessage].
 */
export function runCommand(
  command: string,
  cwd: string,
  timeout = 180_000,
): [boolean, string] {
  try {
    execSync(command, { ...EXEC_OPTIONS, cwd, timeout });
    return [true, ''];
  } catch (err) {
    const message =
      err instanceof Error ? err.message : `Command failed: ${command}`;
    return [false, message];
  }
}

/**
 * Start pm2 with ecosystem config file.
 */
export function startPm2(ecosystemConfigPath: string): [boolean, string] {
  try {
    execSync(`pm2 start ${ecosystemConfigPath}`, EXEC_OPTIONS);
    return [true, ''];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'pm2 start failed';
    return [false, message];
  }
}

/**
 * Stop pm2 processes by name.
 */
export function stopPm2(names: string[]): [boolean, string] {
  try {
    execSync(`pm2 stop ${names.join(' ')}`, EXEC_OPTIONS);
    return [true, ''];
  } catch (err) {
    const message = err instanceof Error ? err.message : 'pm2 stop failed';
    return [false, message];
  }
}

/**
 * Wait for a health endpoint to respond, with polling.
 */
export async function waitForHealthy(
  url: string,
  timeoutMs = 30_000,
  intervalMs = 1_000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHealth(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
