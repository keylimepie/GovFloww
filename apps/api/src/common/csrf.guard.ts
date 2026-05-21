import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, verifyCsrfToken } from './csrf';
import { IS_PUBLIC_KEY } from './decorators';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Bearer-token API clients are not vulnerable to browser cookie CSRF.
    if (!request.cookies?.govflow_access) return true;

    const csrfCookie = request.cookies?.[CSRF_COOKIE_NAME];
    const csrfHeader = request.headers[CSRF_HEADER_NAME]?.toString();
    const csrfSecret = this.config.get<string>('CSRF_SECRET') || this.config.getOrThrow<string>('JWT_REFRESH_SECRET');

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    if (!verifyCsrfToken(csrfCookie, csrfSecret)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}

