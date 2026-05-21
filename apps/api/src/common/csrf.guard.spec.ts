import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CsrfGuard } from './csrf.guard';
import { createCsrfToken, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf';
import { IS_PUBLIC_KEY } from './decorators';

function createContext(request: Record<string, any>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function createGuard(isPublic = false) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === IS_PUBLIC_KEY ? isPublic : undefined)),
  } as unknown as Reflector;
  const config = {
    get: jest.fn(() => undefined),
    getOrThrow: jest.fn(() => 'csrf-test-secret'.repeat(3)),
  } as unknown as ConfigService;
  return new CsrfGuard(reflector, config);
}

describe('CsrfGuard', () => {
  it('allows safe methods without a CSRF token', () => {
    const guard = createGuard();

    expect(guard.canActivate(createContext({ method: 'GET', cookies: {} }))).toBe(true);
  });

  it('allows public mutation routes', () => {
    const guard = createGuard(true);

    expect(guard.canActivate(createContext({ method: 'POST', cookies: {} }))).toBe(true);
  });

  it('requires matching signed CSRF cookie and header for cookie-authenticated mutations', () => {
    const token = createCsrfToken('csrf-test-secret'.repeat(3));
    const guard = createGuard();

    expect(
      guard.canActivate(
        createContext({
          method: 'POST',
          cookies: { govflow_access: 'jwt', [CSRF_COOKIE_NAME]: token },
          headers: { [CSRF_HEADER_NAME]: token },
        }),
      ),
    ).toBe(true);
  });

  it('rejects missing or tampered tokens for cookie-authenticated mutations', () => {
    const guard = createGuard();

    expect(() =>
      guard.canActivate(
        createContext({
          method: 'DELETE',
          cookies: { govflow_access: 'jwt', [CSRF_COOKIE_NAME]: 'tampered' },
          headers: { [CSRF_HEADER_NAME]: 'tampered' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});

