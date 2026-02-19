import type { Role } from './types';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public suggestion?: string;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    public readonly extraFields?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404);
  }
}

export class DebateNotFoundError extends AppError {
  constructor(debateId: string) {
    super('DEBATE_NOT_FOUND', `Debate not found: ${debateId}`, 404, {
      debate_id: debateId,
    });
  }
}

export class ArgumentNotFoundError extends AppError {
  constructor(argumentId: string) {
    super('ARGUMENT_NOT_FOUND', `Argument not found: ${argumentId}`, 404, {
      argument_id: argumentId,
    });
  }
}

export class InvalidInputError extends AppError {
  constructor(message: string, extra?: Record<string, unknown>) {
    super('INVALID_INPUT', message, 400, extra);
  }
}

export class ActionNotAllowedError extends AppError {
  public readonly currentState: string;
  public readonly allowedRoles: Role[];

  constructor(
    message: string,
    opts: {
      current_state: string;
      allowed_roles: Role[];
      suggestion?: string;
    },
  ) {
    super('ACTION_NOT_ALLOWED', message, 403);
    this.currentState = opts.current_state;
    this.allowedRoles = opts.allowed_roles;
    this.suggestion = opts.suggestion;
  }
}

export class ContentTooLargeError extends AppError {
  constructor(maxLength: number) {
    super(
      'CONTENT_TOO_LARGE',
      `Content exceeds maximum length of ${maxLength} bytes`,
      413,
      { max_length: maxLength },
    );
    this.suggestion = `Keep content under ${maxLength} bytes. Use aw docs for larger documents.`;
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('AUTH_FAILED', 'Authentication required', 401);
    this.suggestion = 'Set DEBATE_AUTH_TOKEN environment variable';
  }
}
