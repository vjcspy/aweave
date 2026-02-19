/**
 * Service management for debate commands.
 *
 * Delegates to the process-manager in @hod/aweave-cli-shared.
 * The server (NestJS) serves API + WebSocket + static debate-web SPA
 * on a single port — no separate debate-web service needed.
 */

import {
  ContentType,
  ensureServerRunning,
  getServerStatus,
  MCPContent,
  MCPError,
  MCPResponse,
  stopServer,
} from '@hod/aweave-cli-shared';

/**
 * Ensure the server is running. Auto-starts if needed.
 * Returns MCPResponse for consistent CLI output.
 */
export async function ensureServices(): Promise<MCPResponse> {
  try {
    const statusBefore = await getServerStatus();

    await ensureServerRunning();

    const status = await getServerStatus();

    return new MCPResponse({
      success: true,
      content: [
        new MCPContent({
          type: ContentType.JSON,
          data: {
            status: statusBefore.running ? 'already_running' : 'started',
            server: {
              pid: status.state?.pid,
              port: status.state?.port ?? 3456,
              healthy: status.healthy,
            },
          },
        }),
      ],
    });
  } catch (err: unknown) {
    const error =
      err && typeof err === 'object' && 'message' in err
        ? (err as { code?: string; message: string; suggestion?: string })
        : { code: 'SERVICE_SETUP_FAILED', message: String(err) };

    return new MCPResponse({
      success: false,
      error: new MCPError({
        code: error.code ?? 'SERVICE_SETUP_FAILED',
        message: error.message,
        suggestion:
          error.suggestion ?? 'Try starting manually with: aw server start',
      }),
    });
  }
}

/**
 * Stop the server.
 * Returns MCPResponse for consistent CLI output.
 */
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

/**
 * Get server status.
 * Returns a plain object for embedding in MCPResponse by callers.
 */
export async function getServicesStatus(): Promise<Record<string, unknown>> {
  const status = await getServerStatus();

  return {
    server: {
      running: status.running,
      healthy: status.healthy,
      pid: status.state?.pid ?? null,
      port: status.state?.port ?? 3456,
      started_at: status.state?.startedAt ?? null,
    },
  };
}
