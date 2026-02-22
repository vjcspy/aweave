import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

import { LogContextService } from '../logging/log-context.service';

const CORRELATION_HEADER = 'x-correlation-id';

/**
 * HTTP middleware that establishes per-request correlation context.
 *
 * - Reads `x-correlation-id` from incoming request headers
 * - Generates a UUID if the header is absent or empty
 * - Reflects the resolved correlation ID back via response header
 * - Wraps the downstream handler in an AsyncLocalStorage scope
 *   so all logs within the request automatically include the correlationId
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly logContext: LogContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[CORRELATION_HEADER];
    const correlationId =
      (typeof incoming === 'string' && incoming.trim()) || randomUUID();

    // Set response header for traceability
    res.setHeader(CORRELATION_HEADER, correlationId);

    // Run downstream within the async context scope
    this.logContext.run({ correlationId }, () => {
      next();
    });
  }
}
