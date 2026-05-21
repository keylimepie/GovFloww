import { describe, expect, it, jest } from '@jest/globals';
import * as crypto from 'crypto';
import { LoginSchema } from '@govflow/shared';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('treats a blank login MFA code as not provided', () => {
    expect(
      LoginSchema.parse({
        email: 'admin@govflow.gov.np',
        password: 'Admin@2026!',
        mfaCode: '',
      }),
    ).toEqual({
      email: 'admin@govflow.gov.np',
      password: 'Admin@2026!',
      mfaCode: undefined,
    });
  });

  it('merges role permissions with user-specific extra permissions', () => {
    const service = new AuthService({} as any, {} as any, {} as any, {} as any);
    const merged = (service as any).mergePermissions(
      ['submission:forward', 'user:view_branch'],
      ['user:view_branch', 'org:manage_branches'],
    );

    expect(merged).toEqual(['submission:forward', 'user:view_branch', 'org:manage_branches']);
  });

  it('builds the current session user from active database state', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'user-1',
          email: 'engineer@govflow.gov.np',
          firstName: 'Sita',
          lastName: 'Sharma',
          role: {
            code: 'ENGINEER',
            permissions: ['submission:forward'],
            hierarchyLevel: 50,
          },
          extraPermissions: ['submission:comment'],
          departmentId: 'dept-1',
          department: { name: 'Public Works' },
          branchId: 'branch-1',
          branch: { name: 'Head Office' },
          mustChangePass: false,
        }),
      },
    };
    const service = new AuthService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.getSessionUser('user-1')).resolves.toMatchObject({
      id: 'user-1',
      role: 'ENGINEER',
      permissions: ['submission:forward', 'submission:comment'],
      departmentName: 'Public Works',
      branchName: 'Head Office',
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', status: 'ACTIVE' },
      include: { department: true, branch: true, role: true },
    });
  });

  it('stores and looks up refresh tokens by hash', async () => {
    const service = new AuthService({} as any, {} as any, {} as any, {} as any);
    const rawToken = 'refresh-token-value';
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    expect((service as any).hashRefreshToken(rawToken)).toBe(expectedHash);
  });

  it('revokes refresh tokens by hash during logout', async () => {
    const auditService = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const prisma = {
      refreshToken: {
        updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new AuthService(prisma as any, {} as any, {} as any, auditService as any);
    const rawToken = 'refresh-token-value';
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await service.logout(rawToken, 'user-1', '127.0.0.1');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { token: expectedHash, userId: 'user-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
