import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
      user.role === 'SUPER_ADMIN' || !user.departmentId
        ? {}
        : { departmentId: user.departmentId };

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
        select: {
          id: true,
          name: true,
          code: true,
          departmentId: true,
          branchLevel: true,
          parentBranchId: true,
          clusterType: true,
          nepaliName: true,
          isDorHq: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.workflowDefinition.findMany({
        where: workflowWhere,
        select: { id: true, name: true, code: true, departmentId: true, version: true, metadataSchema: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.role.findMany({
        orderBy: { hierarchyLevel: 'desc' },
      }),
    ]);

    return { departments, branches, workflows, roles };
  }
}
