import { Injectable, LoggerService } from '@nestjs/common';
import type pino from 'pino';

import { LogContextService } from './log-context.service';
import { createLogger } from './logger.factory';

/**
 * Strict plain-object check to avoid false positives on Error, Date,
 * class instances, and arrays.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Custom NestJS LoggerService backed by pino.
 *
 * - Intercepts all Nest logger calls (including existing `new Logger(Context)` usage)
 * - Automatically merges AsyncLocalStorage context (correlationId, etc.) into every log
 * - Writes JSON to file + pretty-prints to stderr in dev
 *
 * Supports **two** call conventions:
 *
 * 1. **NestJS-style** (message first):
 *    log(message, context?)
 *    error(message, stack?, context?)
 *
 * 2. **Pino-style** (merging object first, message string second):
 *    warn({ debateId, correlationId }, 'Failed to get initial state')
 *
 * Pino-style is detected when `message` is a plain object AND `params`
 * contains at least 2 entries (pinoMsg + NestJS context). Detection runs
 * BEFORE `parseParams` to avoid error-level mis-parsing.
 */
@Injectable()
export class NestLoggerService implements LoggerService {
  private readonly pinoLogger: pino.Logger;

  constructor(private readonly logContext: LogContextService) {
    // service: 'aweave-server' maintains backward compat with dashboard log filters
    this.pinoLogger = createLogger({
      name: 'nestjs-server',
      service: 'nestjs-server',
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
   * Pino-style early detection runs FIRST so that `parseParams` never
   * mis-interprets the Pino message string as a NestJS stack trace or context.
   */
  private writeLog(
    level: pino.Level,
    message: unknown,
    params: unknown[],
  ): void {
    // ── Pino-style early detection ─────────────────────────────────
    // Pattern: logger.warn({ key: val }, 'message string')
    // After NestJS Logger processing, params arrive as:
    //   ['message string', 'ContextName'] or ['message string']
    //
    // Only activates when params.length >= 2. When params.length === 1,
    // it's ambiguous — the single string could be either a Pino message
    // or a NestJS context appended by Logger. We fall back to NestJS-style
    // to preserve backward compatibility.
    if (isPlainObject(message) && params.length > 0) {
      const pinoMsg = this.extractPinoMessage(params);
      if (pinoMsg !== undefined) {
        const nestContext = this.extractLastStringParam(params, pinoMsg);
        const asyncContext = this.logContext.getAll();
        const logObj: Record<string, unknown> = {
          ...asyncContext,
          ...(message as Record<string, unknown>),
        };
        if (nestContext) logObj.context = nestContext;
        this.pinoLogger[level](logObj, pinoMsg);
        return;
      }
    }

    // ── Standard NestJS-style path (unchanged) ─────────────────────
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

  /**
   * For Pino-style calls, extract the message string from params.
   * Params arrive as [pinoMsg, nestContext] after NestJS Logger processing.
   * Returns the message string, or undefined if pattern doesn't match.
   *
   * IMPORTANT: Only activates when params.length >= 2. When params.length === 1,
   * it's ambiguous — the single string could be either a Pino message or a NestJS
   * context appended by Logger. We fall back to NestJS-style to preserve backward
   * compatibility (e.g., `logger.warn({ foo: 'bar' })` where NestJS appends context).
   */
  private extractPinoMessage(params: unknown[]): string | undefined {
    if (params.length >= 2 && typeof params[0] === 'string') {
      return params[0];
    }
    return undefined;
  }

  /**
   * Extract NestJS context (last string param) excluding the pinoMsg.
   */
  private extractLastStringParam(
    params: unknown[],
    excludeMsg: string,
  ): string | undefined {
    if (params.length < 2) return undefined;
    const last = params[params.length - 1];
    return typeof last === 'string' && last !== excludeMsg ? last : undefined;
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
