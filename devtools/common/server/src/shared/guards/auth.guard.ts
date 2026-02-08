import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Optional bearer token authentication guard.
 *
 * If AUTH_TOKEN env var is set, all requests must include:
 *   Authorization: Bearer <token>
 *
 * If AUTH_TOKEN is not set, all requests are allowed (dev mode).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.AUTH_TOKEN;
    if (!token) return true; // No auth in dev mode

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization || '';
    const [scheme, value] = header.split(' ');

    if (scheme !== 'Bearer' || value !== token) {
      throw new UnauthorizedException('Authentication required');
    }

    return true;
  }
}
