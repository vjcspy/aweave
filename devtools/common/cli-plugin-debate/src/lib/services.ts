/**
 * Service management for aweave-server and debate-web.
 *
 * Handles build, start via pm2, and health checks.
 * Port of Python debate/services.py updated for unified NestJS server.
 */

import {
  checkHealth,
  checkPm2Process,
  ContentType,
  MCPContent,
  MCPError,
  MCPResponse,
  runCommand,
  startPm2,
  stopPm2,
  waitForHealthy,
} from '@aweave/cli-shared';
import { existsSync } from 'fs';
import { resolve } from 'path';

interface ServiceConfig {
  name: string;
  port: number;
  cwd: string;
  buildCheckPath: string;
  healthUrl: string;
}

// Path resolution: cli-debate/src/services.ts -> devtools/
// At runtime (dist/): cli-debate/dist/services.js
// Go up: dist -> cli-debate -> common -> devtools
const DEVTOOLS_ROOT = resolve(__dirname, '..', '..', '..');
const SERVER_DIR = resolve(DEVTOOLS_ROOT, 'common', 'server');
const DEBATE_WEB_DIR = resolve(DEVTOOLS_ROOT, 'common', 'debate-web');
const ECOSYSTEM_CONFIG = resolve(DEVTOOLS_ROOT, 'ecosystem.config.cjs');

const SERVICES: Record<string, ServiceConfig> = {
  'aweave-server': {
    name: 'aweave-server',
    port: 3456,
    cwd: SERVER_DIR,
    buildCheckPath: 'dist',
    healthUrl: 'http://127.0.0.1:3456/health',
  },
  'debate-web': {
    name: 'debate-web',
    port: 3457,
    cwd: DEBATE_WEB_DIR,
    buildCheckPath: '.next',
    healthUrl: 'http://127.0.0.1:3457',
  },
};

const BUILD_TIMEOUT = 180_000; // ms

function needsInstall(cwd: string): boolean {
  return !existsSync(resolve(cwd, 'node_modules'));
}

function needsBuild(service: ServiceConfig): boolean {
  return !existsSync(resolve(service.cwd, service.buildCheckPath));
}

async function isServiceRunning(service: ServiceConfig): Promise<boolean> {
  return checkHealth(service.healthUrl);
}

export function getServicesStatus(): Record<string, unknown> {
  const status: Record<string, unknown> = {};
  for (const [name, service] of Object.entries(SERVICES)) {
    status[name] = {
      port: service.port,
      pm2_online: checkPm2Process(name),
      needs_build: needsBuild(service),
      needs_install: needsInstall(service.cwd),
    };
  }
  return status;
}

export async function ensureServices(): Promise<MCPResponse> {
  const stepsPerformed: string[] = [];

  // Check if both services already running
  const serverRunning = await isServiceRunning(SERVICES['aweave-server']);
  const webRunning = await isServiceRunning(SERVICES['debate-web']);

  if (serverRunning && webRunning) {
    return new MCPResponse({
      success: true,
      content: [
        new MCPContent({
          type: ContentType.JSON,
          data: {
            status: 'already_running',
            services: {
              'aweave-server': { port: 3456, status: 'running' },
              'debate-web': { port: 3457, status: 'running' },
            },
          },
        }),
      ],
    });
  }

  // Process each service that needs setup
  for (const [name, service] of Object.entries(SERVICES)) {
    if (needsInstall(service.cwd)) {
      stepsPerformed.push(`pnpm install (${name})`);
      const [ok, err] = runCommand('pnpm install', service.cwd, BUILD_TIMEOUT);
      if (!ok) {
        return new MCPResponse({
          success: false,
          error: new MCPError({
            code: 'SERVICE_SETUP_FAILED',
            message: err,
            suggestion: `Run 'cd ${service.cwd} && pnpm install' manually to diagnose`,
          }),
        });
      }
    }

    if (needsBuild(service)) {
      stepsPerformed.push(`pnpm build (${name})`);
      const [ok, err] = runCommand('pnpm build', service.cwd, BUILD_TIMEOUT);
      if (!ok) {
        return new MCPResponse({
          success: false,
          error: new MCPError({
            code: 'SERVICE_BUILD_FAILED',
            message: err,
            suggestion: `Run 'cd ${service.cwd} && pnpm build' manually to diagnose`,
          }),
        });
      }
    }
  }

  // Start via pm2 if needed
  let needsPm2Start = false;
  for (const [name, service] of Object.entries(SERVICES)) {
    if (!(await isServiceRunning(service)) && !checkPm2Process(name)) {
      needsPm2Start = true;
      break;
    }
  }

  if (needsPm2Start) {
    stepsPerformed.push('pm2 start');
    const [ok, err] = startPm2(ECOSYSTEM_CONFIG);
    if (!ok) {
      return new MCPResponse({
        success: false,
        error: new MCPError({
          code: 'SERVICE_START_FAILED',
          message: err,
          suggestion: 'Check pm2 logs: pm2 logs',
        }),
      });
    }
  }

  // Wait for health
  for (const [name, service] of Object.entries(SERVICES)) {
    stepsPerformed.push(`health check (${name})`);
    const healthy = await waitForHealthy(service.healthUrl);
    if (!healthy) {
      return new MCPResponse({
        success: false,
        error: new MCPError({
          code: 'SERVICE_HEALTH_CHECK_FAILED',
          message: `${name} did not become healthy within 30s`,
          suggestion: `Check logs: pm2 logs ${name}`,
        }),
      });
    }
  }

  return new MCPResponse({
    success: true,
    content: [
      new MCPContent({
        type: ContentType.JSON,
        data: {
          status: 'started',
          steps_performed: stepsPerformed,
          services: {
            'aweave-server': { port: 3456, status: 'running' },
            'debate-web': { port: 3457, status: 'running' },
          },
        },
      }),
    ],
  });
}

export async function stopServices(): Promise<MCPResponse> {
  const [ok, err] = stopPm2(['aweave-server', 'debate-web']);
  if (!ok) {
    return new MCPResponse({
      success: false,
      error: new MCPError({
        code: 'SERVICE_STOP_FAILED',
        message: err,
      }),
    });
  }
  return new MCPResponse({
    success: true,
    content: [
      new MCPContent({
        type: ContentType.JSON,
        data: { status: 'stopped' },
      }),
    ],
  });
}
