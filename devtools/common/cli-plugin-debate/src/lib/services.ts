/**
 * Service management for aweave-server and debate-web.
 *
 * Handles build, start via pm2, and health checks.
 * Port of Python debate/services.py updated for unified NestJS server.
 */

import {
  ContentType,
  getServerStatus,
  MCPContent,
  MCPError,
  MCPResponse,
  startServer,
  stopServer,
} from '@aweave/cli-shared';

import { DEBATE_SERVER_URL } from './config';

function parseServerUrl(): { host: string; port: number; baseUrl: string } {
  try {
    const url = new URL(DEBATE_SERVER_URL);
    const port = url.port ? Number(url.port) : 3456;
    return { host: url.hostname || '127.0.0.1', port, baseUrl: url.origin };
  } catch {
    return { host: '127.0.0.1', port: 3456, baseUrl: 'http://127.0.0.1:3456' };
  }
}

export async function getServicesStatus(): Promise<Record<string, unknown>> {
  const { host, port, baseUrl } = parseServerUrl();
  const status = await getServerStatus();

  return {
    'aweave-server': {
      host,
      port,
      running: status.running,
      healthy: status.healthy,
      ...(status.state && {
        pid: status.state.pid,
        started_at: status.state.startedAt,
        version: status.state.version,
      }),
    },
    'debate-web': {
      integrated: true,
      url: `${baseUrl}/debate`,
      served_by: 'aweave-server',
    },
  };
}

export async function ensureServices(): Promise<MCPResponse> {
  const { host, port } = parseServerUrl();

  const status = await getServerStatus();
  if (status.running && status.healthy) {
    const services = await getServicesStatus();
    return new MCPResponse({
      success: true,
      content: [
        new MCPContent({
          type: ContentType.JSON,
          data: { status: 'already_running', services },
        }),
      ],
    });
  }

  const result = await startServer({ host, port });
  if (!result.success) {
    return new MCPResponse({
      success: false,
      error: new MCPError({
        code: 'SERVICE_START_FAILED',
        message: result.message,
        suggestion: "Run 'aw server start --open' to diagnose, then retry",
      }),
    });
  }

  const services = await getServicesStatus();
  return new MCPResponse({
    success: true,
    content: [
      new MCPContent({
        type: ContentType.JSON,
        data: { status: 'started', services },
      }),
    ],
  });
}

export async function stopServices(): Promise<MCPResponse> {
  const result = await stopServer();
  if (!result.success) {
    return new MCPResponse({
      success: false,
      error: new MCPError({
        code: 'SERVICE_STOP_FAILED',
        message: result.message,
      }),
    });
  }
  return new MCPResponse({
    success: true,
    content: [
      new MCPContent({
        type: ContentType.JSON,
        data: { status: 'stopped', message: result.message },
      }),
    ],
  });
}
