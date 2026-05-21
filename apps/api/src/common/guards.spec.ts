import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './guards';
import { PERMISSIONS_KEY } from './decorators';

function createContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows access when the user has any listed permission', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === PERMISSIONS_KEY ? ['submission:reject_any', 'submission:reject_prev'] : undefined,
      ),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);

    expect(
      guard.canActivate(createContext({ sub: 'u1', role: 'ENGINEER', permissions: ['submission:reject_prev'] })),
    ).toBe(true);
  });

  it('denies access when none of the listed permissions are present', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === PERMISSIONS_KEY ? ['submission:hold'] : undefined,
      ),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ sub: 'u1', role: 'ENGINEER', permissions: ['submission:forward'] })),
    ).toThrow(ForbiddenException);
  });
});
