import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload, AuditAction } from '@govflow/shared';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /** List all roles ordered by hierarchy */
  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { hierarchyLevel: 'desc' },
      include: {
        _count: { select: { users: true } },
      },
    });
  }

  /** Create a new custom role */
  async create(dto: { name: string; code: string; hierarchyLevel: number; permissions: string[] }, admin: JwtPayload, ipAddress: string) {
    const existing = await this.prisma.role.findFirst({
      where: { OR: [{ name: dto.name }, { code: dto.code }] },
    });
    if (existing) throw new ConflictException('Role with this name or code already exists');

    if (dto.hierarchyLevel >= admin.hierarchyLevel && admin.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot create a role with a hierarchy level equal to or higher than your own');
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase().replace(/\s+/g, '_'),
        hierarchyLevel: Number(dto.hierarchyLevel),
        permissions: dto.permissions,
        isSystem: false,
      },
    });

    await this.auditService.log({
      actorId: admin.sub,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'ROLE_CREATED', roleId: role.id, name: role.name },
      ipAddress,
    });

    return role;
  }

  /** Update a role */
  async update(id: string, dto: { name?: string; permissions?: string[]; hierarchyLevel?: number }, admin: JwtPayload, ipAddress: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    if (admin.role !== 'SUPER_ADMIN' && role.hierarchyLevel >= admin.hierarchyLevel) {
      throw new BadRequestException('Cannot modify a role with a hierarchy level equal to or higher than your own');
    }

    if (dto.hierarchyLevel !== undefined && dto.hierarchyLevel >= admin.hierarchyLevel && admin.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot elevate a role to a hierarchy level equal to or higher than your own');
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        permissions: dto.permissions ?? undefined,
        hierarchyLevel: dto.hierarchyLevel !== undefined ? Number(dto.hierarchyLevel) : undefined,
      },
    });

    await this.auditService.log({
      actorId: admin.sub,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'ROLE_UPDATED', roleId: id, changes: dto },
      ipAddress,
    });

    return updated;
  }

  /** Delete a custom role */
  async remove(id: string, admin: JwtPayload, ipAddress: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true, stages: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');

    if (role.isSystem) throw new BadRequestException('Cannot delete a system role');
    if (role._count.users > 0) throw new BadRequestException('Cannot delete role. It is assigned to active users.');
    if (role._count.stages > 0) throw new BadRequestException('Cannot delete role. It is assigned to workflow stages.');

    if (admin.role !== 'SUPER_ADMIN' && role.hierarchyLevel >= admin.hierarchyLevel) {
      throw new BadRequestException('Cannot delete a role with a hierarchy level equal to or higher than your own');
    }

    await this.prisma.role.delete({ where: { id } });

    await this.auditService.log({
      actorId: admin.sub,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'ROLE_DELETED', roleId: id, name: role.name },
      ipAddress,
    });
  }

  /** Bulk reorder roles (updates hierarchyLevel) */
  async reorder(updates: { id: string; hierarchyLevel: number }[], admin: JwtPayload, ipAddress: string) {
    if (admin.role !== 'SUPER_ADMIN') throw new BadRequestException('Only Super Admin can bulk reorder roles');

    await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.role.update({
          where: { id: update.id },
          data: { hierarchyLevel: update.hierarchyLevel },
        }),
      ),
    );

    await this.auditService.log({
      actorId: admin.sub,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'ROLES_REORDERED' },
      ipAddress,
    });
  }
}
