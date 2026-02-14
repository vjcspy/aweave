import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { dirname, extname, join } from 'path';

/**
 * Resolve tracing-log-web SPA index.html path.
 * Works in both published (node_modules) and dev (public/) contexts.
 */
function resolveTracingLogIndexHtml(): string {
  try {
    const pkgPath = require.resolve('@hod/aweave-nab-tracing-log-web/package.json');
    return join(dirname(pkgPath), 'dist', 'index.html');
  } catch {
    return join(__dirname, '..', 'public', 'tracing-log', 'index.html');
  }
}

const TRACING_LOG_INDEX_HTML = resolveTracingLogIndexHtml();

/**
 * SPA fallback controller for tracing-log-web.
 *
 * Only handles routes WITHOUT file extensions (client-side routes like /tracing-log/viewer?correlationId=xxx).
 * Requests WITH file extensions (.js, .css, .woff2, etc.) are left to express.static.
 */
@Controller()
export class TracingLogSpaController {
  @Get(['/tracing-log', '/tracing-log/*path'])
  serveTracingLogSpa(@Req() req: Request, @Res() res: Response) {
    // If the URL has a file extension, it's a static asset request.
    // Let Express return 404 — static asset middleware should have handled it.
    if (extname(req.path)) {
      return res.status(404).send('Not found');
    }

    // SPA fallback — serve index.html for client-side routing
    return res.sendFile(TRACING_LOG_INDEX_HTML);
  }
}
