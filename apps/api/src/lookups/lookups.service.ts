import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@govflow/shared';
import type { JwtPayload } from '@govflow/shared';

@Injectable()
export class LookupsService {
  constructor(private prisma: PrismaService) {}

  async getBootstrap(user: JwtPayload) {
    const departmentWhere =
      user.role === 'SUPER_ADMIN' || !user.departmentId
        ? {}
        : { id: user.departmentId };

    const branchWhere =
      user.role === 'SUPER_ADMIN' || !user.branchId ? {} : { id: user.branchId };

    const workflowWhere =
      user.role === 'SUPER_ADMIN' || !user.departmentId
        ? { status: 'ACTIVE' }
        : { status: 'ACTIVE', departmentId: user.departmentId };

    const [departments, branches, workflows, roles] = await Promise.all([
      this.prisma.department.findMany({
        where: departmentWhere,
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.branch.findMany({
        where: branchWhere,
        select: { id: true, name: true, code: true, departmentId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workflowDefinition.findMany({
        where: workflowWhere,
        select: { id: true, name: true, departmentId: true, version: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.role.findMany({
        orderBy: { hierarchyLevel: 'desc' },
      }),
    ]);

    return { departments, branches, workflows, roles };
  }
}
