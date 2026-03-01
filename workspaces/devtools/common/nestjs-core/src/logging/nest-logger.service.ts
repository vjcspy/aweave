import { Injectable, LoggerService } from '@nestjs/common';
import type pino from 'pino';

import { LogContextService } from './log-context.service';
import { createLogger } from './logger.factory';

/**
 * Custom NestJS LoggerService backed by pino.
 *
 * - Intercepts all Nest logger calls (including existing `new Logger(Context)` usage)
 * - Automatically merges AsyncLocalStorage context (correlationId, etc.) into every log
 * - Writes JSON to file + pretty-prints to stderr in dev
 *
 * NestJS calls logger methods with these signatures:
 *   log(message, context?)          — context is the Nest Logger context (class name)
 *   log(message, ...args, context?) — sometimes extra args before context
 *   error(message, stack?, context?)
 */
@Injectable()
export class NestLoggerService implements LoggerService {
  private readonly pinoLogger: pino.Logger;

  constructor(private readonly logContext: LogContextService) {
    // service: 'aweave-server' maintains backward compat with dashboard log filters
    this.pinoLogger = createLogger({
      name: 'server',
      service: 'aweave-server',
    });
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.writeLog('fatal', message, optionalParams);
  }

  /**
   * Internal: route a Nest log call to pino with context merging.
   *
   * NestJS Logger calls have varied shapes:
   * - (message)
   * - (message, context)
   * - (message, meta, context)   — where meta is an object
   * - error(message, stack, context)
   *
   * The last string param is always the Nest "context" (class/module name).
   */
  private writeLog(
    level: pino.Level,
    message: unknown,
    params: unknown[],
  ): void {
    // Extract Nest context (last string param) and any metadata
    const { context, meta, stack } = this.parseParams(params, level);

    // Merge AsyncLocalStorage context (correlationId, etc.)
    const asyncContext = this.logContext.getAll();

    // Build the log object
    const logObj: Record<string, unknown> = {
      ...asyncContext,
      ...(typeof meta === 'object' && meta !== null ? meta : {}),
    };

    if (context) {
      logObj.context = context;
    }

    if (stack) {
      logObj.stack = stack;
    }

    // Get the string message
    const msg = typeof message === 'string' ? message : JSON.stringify(message);

    // Write to pino at the appropriate level
    this.pinoLogger[level](logObj, msg);
  }

  private parseParams(
    params: unknown[],
    level: pino.Level,
  ): { context?: string; meta?: unknown; stack?: string } {
    if (params.length === 0) return {};

    // For error level: (message, stack?, context?)
    if (level === 'error' && params.length >= 1) {
      if (params.length === 1) {
        // Could be context or stack
        if (typeof params[0] === 'string') {
          return { context: params[0] };
        }
        return { meta: params[0] };
      }
      if (params.length >= 2) {
        const last = params[params.length - 1];
        const secondToLast = params[params.length - 2];

        if (typeof last === 'string' && typeof secondToLast === 'string') {
          // error(message, stack, context)
          return { stack: secondToLast, context: last };
        }
        if (typeof last === 'string') {
          // error(message, metaOrStack, context)
          const metaOrStack = params.slice(0, -1);
          if (
            metaOrStack.length === 1 &&
            typeof metaOrStack[0] === 'string' &&
            metaOrStack[0].includes('\n')
          ) {
            return { stack: metaOrStack[0], context: last };
          }
          return {
            meta: metaOrStack.length === 1 ? metaOrStack[0] : metaOrStack,
            context: last,
          };
        }
        return { meta: params };
      }
    }

    // For other levels: last string param is context
    const last = params[params.length - 1];
    if (typeof last === 'string') {
      const remaining = params.slice(0, -1);
      return {
        context: last,
        meta:
          remaining.length === 1
            ? remaining[0]
            : remaining.length > 0
              ? remaining
              : undefined,
      };
    }

    // No string context — everything is metadata
    return {
      meta: params.length === 1 ? params[0] : params,
    };
  }
}
