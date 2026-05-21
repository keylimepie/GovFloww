import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, jest } from '@jest/globals';
import { MustChangePasswordGuard } from './must-change-password.guard';
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

function createGuard(mustChangePass: boolean, isPublic = false) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === IS_PUBLIC_KEY ? isPublic : undefined)),
  } as unknown as Reflector;
  const prisma = {
    user: {
      findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ mustChangePass }),
    },
  };
  return {
    guard: new MustChangePasswordGuard(reflector, prisma as any),
    prisma,
  };
}

describe('MustChangePasswordGuard', () => {
  it('allows safe methods without a database check', async () => {
    const { guard, prisma } = createGuard(true);

    await expect(guard.canActivate(createContext({ method: 'GET', path: '/api/submissions' }))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows the password change endpoint', async () => {
    const { guard, prisma } = createGuard(true);

    await expect(
      guard.canActivate(createContext({ method: 'POST', path: '/api/users/me/password', user: { sub: 'u1' } })),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('blocks mutating requests while password change is required', async () => {
    const { guard } = createGuard(true);

    await expect(
      guard.canActivate(createContext({ method: 'POST', path: '/api/submissions', user: { sub: 'u1' } })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows mutating requests after password change is complete', async () => {
    const { guard } = createGuard(false);

    await expect(
      guard.canActivate(createContext({ method: 'POST', path: '/api/submissions', user: { sub: 'u1' } })),
    ).resolves.toBe(true);
  });
});

