import { LogContextService } from '@hod/aweave-nestjs-core';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Inject,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global exception filter that formats all errors into the standard envelope:
 * { success: false, error: { code, message, suggestion?, ...extra } }
 *
 * This catches both custom AppError (from debate module) and NestJS HttpExceptions.
 * Includes correlationId and request metadata in structured error logs.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  constructor(
    @Inject(LogContextService)
    private readonly logContext: LogContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = this.logContext.get<string>('correlationId');
    const requestMeta = {
      correlationId,
      method: request?.method,
      path: request?.url,
    };

    // Handle custom AppError from feature modules
    if (this.isAppError(exception)) {
      const err = exception as {
        code: string;
        message: string;
        statusCode: number;
        suggestion?: string;
        currentState?: string;
        allowedRoles?: string[];
        extraFields?: Record<string, unknown>;
      };

      const errorObj: Record<string, unknown> = {
        code: err.code,
        message: err.message,
      };

      if (err.suggestion) errorObj.suggestion = err.suggestion;
      if (err.currentState) errorObj.current_state = err.currentState;
      if (err.allowedRoles) errorObj.allowed_roles = err.allowedRoles;
      if (err.extraFields) Object.assign(errorObj, err.extraFields);

      this.logger.warn(
        { ...requestMeta, errorCode: err.code, statusCode: err.statusCode },
        `AppError: ${err.message}`,
      );

      response.status(err.statusCode).json({
        success: false,
        error: errorObj,
      });
      return;
    }

    // Handle NestJS HttpExceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      this.logger.warn(
        { ...requestMeta, statusCode: status },
        `HttpException: ${exception.message}`,
      );

      response.status(status).json({
        success: false,
        error: {
          code: 'HTTP_ERROR',
          message: exception.message,
        },
      });
      return;
    }

    // Unknown errors
    this.logger.error(
      { ...requestMeta, err: exception },
      'Unhandled exception',
    );
    response.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal error',
      },
    });
  }

  private isAppError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const obj = err as Record<string, unknown>;
    return (
      typeof obj.code === 'string' &&
      typeof obj.statusCode === 'number' &&
      typeof obj.message === 'string'
    );
  }
}
