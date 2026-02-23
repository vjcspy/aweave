import type { MiddlewareConsumer } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import * as express from 'express';
import { existsSync } from 'fs';
import { extname, join } from 'path';

/**
 * Options for SPA middleware registration.
 */
export interface SpaServeOptions {
  /** Pre-resolved absolute path to the SPA dist directory */
  rootPath: string;
  /** URL prefix (e.g., '/debate') */
  routePrefix: string;
}

/**
 * Register static file serving + SPA fallback middleware for a given route prefix.
 *
 * NestJS `MiddlewareConsumer.forRoutes('/prefix')` uses Express Router internally,
 * which strips the route prefix before calling middleware. So `express.static(rootPath)`
 * receives relative paths (e.g., `/assets/main.js`), not full paths.
 *
 * Design note (pnpm strict isolation):
 * This utility does NOT resolve web packages itself. `require.resolve()` resolves
 * from the file's physical location, not the caller's. Since `nestjs-core` doesn't
 * have web packages in its dependencies, resolution would always fail. Each feature
 * module resolves its own web package path and passes the pre-resolved `rootPath`.
 */
export function applySpaMiddleware(
  consumer: MiddlewareConsumer,
  options: SpaServeOptions,
): void {
  const { rootPath, routePrefix } = options;

  if (!existsSync(rootPath)) {
    return;
  }

  const indexHtml = join(rootPath, 'index.html');

  // SPA fallback: serve index.html for routes without file extensions
  const spaFallback = (_req: Request, res: Response, next: NextFunction) => {
    if (extname(_req.url)) {
      // Has file extension — let express.static handle or 404
      next();
      return;
    }
    res.sendFile(indexHtml);
  };

  consumer
    .apply(express.static(rootPath), spaFallback)
    .forRoutes(routePrefix, `${routePrefix}/(.*)`);
}
