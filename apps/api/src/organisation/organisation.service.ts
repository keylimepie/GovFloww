import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@govflow/shared';
import type {
  CreateBranchInput,
  CreateDepartmentInput,
  JwtPayload,
  UpdateBranchInput,
  UpdateDepartmentInput,
} from '@govflow/shared';

@Injectable()
export class OrganisationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listDepartments(user: JwtPayload) {
    return this.prisma.department.findMany({
      where: user.role === 'SUPER_ADMIN' || !user.departmentId ? {} : { id: user.departmentId },
      include: { _count: { select: { branches: true, users: true, workflows: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(dto: CreateDepartmentInput, user: JwtPayload, ipAddress: string) {
    const organisationId = dto.organisationId || await this.getDefaultOrganisationId();
    await this.ensureUniqueDepartmentCode(dto.code);

    const department = await this.prisma.department.create({
      data: {
        name: dto.name,
        code: dto.code,
        organisationId,
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'DEPARTMENT_CREATED', departmentId: department.id, code: department.code },
      ipAddress,
    });

    return department;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentInput, user: JwtPayload, ipAddress: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    if (dto.code && dto.code !== existing.code) await this.ensureUniqueDepartmentCode(dto.code);

    const department = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        code: dto.code ?? undefined,
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'DEPARTMENT_UPDATED', departmentId: id, changes: dto },
      ipAddress,
    });

    return department;
  }

  async listBranches(user: JwtPayload) {
    return this.prisma.branch.findMany({
      where: this.departmentScopedWhere(user),
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count: { select: { users: true, submissions: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createBranch(dto: CreateBranchInput, user: JwtPayload, ipAddress: string) {
    this.ensureCanManageDepartment(user, dto.departmentId);
    await this.ensureUniqueBranchCode(dto.code);

    const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!department) throw new NotFoundException('Department not found');

    const branch = await this.prisma.branch.create({
      data: {
        name: dto.name,
        code: dto.code,
        departmentId: dto.departmentId,
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'BRANCH_CREATED', branchId: branch.id, departmentId: dto.departmentId },
      ipAddress,
    });

    return branch;
  }

  async updateBranch(id: string, dto: UpdateBranchInput, user: JwtPayload, ipAddress: string) {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Branch not found');

    const targetDepartmentId = dto.departmentId || existing.departmentId;
    this.ensureCanManageDepartment(user, existing.departmentId);
    this.ensureCanManageDepartment(user, targetDepartmentId);
    if (dto.code && dto.code !== existing.code) await this.ensureUniqueBranchCode(dto.code);

    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        code: dto.code ?? undefined,
        departmentId: dto.departmentId ?? undefined,
      },
    });

    await this.audit.log({
      actorId: user.sub,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'BRANCH_UPDATED', branchId: id, changes: dto },
      ipAddress,
    });

    return branch;
  }

  private async getDefaultOrganisationId() {
    const organisation = await this.prisma.organisation.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!organisation) throw new BadRequestException('No organisation configured');
    return organisation.id;
  }

  private async ensureUniqueDepartmentCode(code: string) {
    const existing = await this.prisma.department.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Department code already exists');
  }

  private async ensureUniqueBranchCode(code: string) {
    const existing = await this.prisma.branch.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Branch code already exists');
  }

  private departmentScopedWhere(user: JwtPayload) {
    if (user.role === 'SUPER_ADMIN' || !user.departmentId) return {};
    return { departmentId: user.departmentId };
  }

  private ensureCanManageDepartment(user: JwtPayload, departmentId: string) {
    if (user.role === 'SUPER_ADMIN') return;
    if (!user.permissions.includes('org:manage_branches')) {
      throw new ForbiddenException('Missing branch management permission');
    }
    if (!user.departmentId || user.departmentId !== departmentId) {
      throw new ForbiddenException('Cannot manage branches outside your department');
    }
  }
}
