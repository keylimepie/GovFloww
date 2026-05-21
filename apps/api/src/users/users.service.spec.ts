import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { AuditAction } from '@govflow/shared';
import * as totp from '../auth/totp';

describe('UsersService password changes', () => {
  it('changes the current user password and clears mustChangePass', async () => {
    const oldHash = await bcrypt.hash('OldPass123!', 4);
    const prisma = {
      user: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'user-1',
          passwordHash: oldHash,
        }),
        update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'user-1' }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new UsersService(prisma as any, audit as any);

    await service.changeOwnPassword(
      'user-1',
      { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' },
      '127.0.0.1',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: expect.any(String),
        mustChangePass: false,
      },
    });
    const updatePayload = (prisma.user.update as any).mock.calls[0][0];
    expect(await bcrypt.compare('NewPass123!', updatePayload.data.passwordHash)).toBe(true);
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'user-1',
      action: AuditAction.USER_UPDATED,
      metadata: { action: 'PASSWORD_CHANGED' },
      ipAddress: '127.0.0.1',
    });
  });

  it('rejects an incorrect current password', async () => {
    const oldHash = await bcrypt.hash('OldPass123!', 4);
    const prisma = {
      user: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'user-1',
          passwordHash: oldHash,
        }),
      },
    };
    const service = new UsersService(prisma as any, {} as any);

    await expect(
      service.changeOwnPassword(
        'user-1',
        { currentPassword: 'WrongPass123!', newPassword: 'NewPass123!' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects reusing the same password', async () => {
    const oldHash = await bcrypt.hash('OldPass123!', 4);
    const prisma = {
      user: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'user-1',
          passwordHash: oldHash,
        }),
      },
    };
    const service = new UsersService(prisma as any, {} as any);

    await expect(
      service.changeOwnPassword(
        'user-1',
        { currentPassword: 'OldPass123!', newPassword: 'OldPass123!' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('UsersService MFA', () => {
  it('creates a pending MFA secret and otpauth URI', async () => {
    const prisma = {
      user: {
        update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'user-1' }),
      },
    };
    const service = new UsersService(prisma as any, {} as any);

    const result = await service.setupMfa('user-1', 'user@govflow.gov.np');

    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.otpauthUri).toContain('otpauth://totp/');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        mfaSecret: result.secret,
        mfaEnabled: false,
      },
    });
  });

  it('enables MFA when the verification code is valid', async () => {
    jest.spyOn(totp, 'verifyTotp').mockReturnValueOnce(true);
    const prisma = {
      user: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'user-1', mfaSecret: 'SECRET' }),
        update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'user-1' }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new UsersService(prisma as any, audit as any);

    await service.enableMfa('user-1', '123456', '127.0.0.1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { mfaEnabled: true },
    });
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'user-1',
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'MFA_ENABLED' },
      ipAddress: '127.0.0.1',
    });
  });
});
