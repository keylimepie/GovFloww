import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { OrganisationService } from './organisation.service';

describe('OrganisationService', () => {
  it('allows a department admin with branch management permission to add a branch in their department', async () => {
    const prisma = {
      branch: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(null),
        create: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'branch-1',
          name: 'Site Office',
          code: 'SITE',
          departmentId: 'dept-1',
        }),
      },
      department: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'dept-1' }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new OrganisationService(prisma as any, audit as any);

    await expect(
      service.createBranch(
        { name: 'Site Office', code: 'SITE', departmentId: 'dept-1' },
        {
          sub: 'admin-1',
          email: 'admin@example.com',
          role: 'DEPARTMENT_ADMIN',
          roleId: 'role-1',
          permissions: ['org:manage_branches'],
          hierarchyLevel: 80,
          departmentId: 'dept-1',
          branchId: null,
        },
        '127.0.0.1',
      ),
    ).resolves.toMatchObject({ id: 'branch-1' });
  });

  it('blocks branch creation outside the user department', async () => {
    const service = new OrganisationService({} as any, {} as any);

    await expect(
      service.createBranch(
        { name: 'Other Office', code: 'OTHER', departmentId: 'dept-2' },
        {
          sub: 'admin-1',
          email: 'admin@example.com',
          role: 'DEPARTMENT_ADMIN',
          roleId: 'role-1',
          permissions: ['org:manage_branches'],
          hierarchyLevel: 80,
          departmentId: 'dept-1',
          branchId: null,
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
