import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { dirname, extname, join } from 'path';

/**
 * Resolve debate-web SPA index.html path.
 * Works in both published (node_modules) and dev (public/) contexts.
 */
function resolveDebateIndexHtml(): string {
  try {
    const pkgPath = require.resolve('@hod/aweave-debate-web/package.json');
    return join(dirname(pkgPath), 'dist', 'index.html');
  } catch {
    return join(__dirname, '..', 'public', 'debate', 'index.html');
  }
}

const DEBATE_INDEX_HTML = resolveDebateIndexHtml();

/**
 * SPA fallback controller for debate-web.
 *
 * Only handles routes WITHOUT file extensions (client-side routes like /debate/debates/123).
 * Requests WITH file extensions (.js, .css, .woff2, etc.) are left to ServeStaticModule.
 */
@Controller()
export class DebateSpaController {
  @Get(['/debate', '/debate/*path'])
  serveDebateSpa(@Req() req: Request, @Res() res: Response) {
    // If the URL has a file extension, it's a static asset request.
    // Let Express return 404 — ServeStaticModule should have handled it.
    if (extname(req.path)) {
      return res.status(404).send('Not found');
    }

    // SPA fallback — serve index.html for client-side routing
    return res.sendFile(DEBATE_INDEX_HTML);
  }
}
