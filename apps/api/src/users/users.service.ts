// =============================================
// Users Service — User Management
// =============================================

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, UserStatus } from '@govflow/shared';
import type { ChangePasswordInput, CreateUserInput, UpdateUserInput, JwtPayload } from '@govflow/shared';
import * as bcrypt from 'bcrypt';
import { createOtpAuthUri, generateTotpSecret, verifyTotp } from '../auth/totp';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /** Create a new user (admin action). */
  async create(dto: CreateUserInput, admin: JwtPayload, ipAddress: string) {
    const targetRole = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!targetRole) throw new BadRequestException('Role not found');

    // Prevent creating users with higher or equal role than yourself
    if (admin.role !== 'SUPER_ADMIN' && targetRole.hierarchyLevel >= admin.hierarchyLevel) {
      throw new ForbiddenException('Cannot create a user with equal or higher role');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
        extraPermissions: dto.extraPermissions || [],
        departmentId: dto.departmentId || null,
        branchId: dto.branchId || null,
        status: UserStatus.ACTIVE,
        mustChangePass: true,
      },
    });

    await this.auditService.log({
      actorId: admin.sub,
      action: AuditAction.USER_CREATED,
      metadata: { userId: user.id, email: user.email, roleId: user.roleId },
      ipAddress,
    });

    const { passwordHash: _, signaturePin: __, mfaSecret: ___, ...safeUser } = user;
    return safeUser;
  }

  /** List users (scoped by admin's department). */
  async findAll(admin: JwtPayload) {
    const where: any = {};
    if (admin.role === 'DEPARTMENT_ADMIN' && admin.departmentId) {
      where.departmentId = admin.departmentId;
    } else if (admin.role === 'BRANCH_ADMIN' && admin.branchId) {
      where.branchId = admin.branchId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: { select: { id: true, name: true, code: true } },
        extraPermissions: true,
        status: true,
        departmentId: true,
        branchId: true,
        department: { select: { name: true } },
        branch: { select: { name: true } },
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get a single user (never return password hash). */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: { select: { id: true, name: true, code: true } },
        extraPermissions: true,
        status: true,
        departmentId: true,
        branchId: true,
        department: { select: { name: true } },
        branch: { select: { name: true } },
        companyName: true,
        phone: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Update user details. */
  async update(id: string, dto: UpdateUserInput, admin: JwtPayload, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.roleId && dto.roleId !== user.roleId) {
      const targetRole = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!targetRole) throw new BadRequestException('Role not found');
      if (admin.role !== 'SUPER_ADMIN' && targetRole.hierarchyLevel >= admin.hierarchyLevel) {
        throw new ForbiddenException('Cannot assign a user to an equal or higher role');
      }
    }

    // Track role change for audit
    const roleChanged = dto.roleId && dto.roleId !== user.roleId;

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName ?? undefined,
        lastName: dto.lastName ?? undefined,
        roleId: dto.roleId ?? undefined,
        extraPermissions: dto.extraPermissions ?? undefined,
        departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
        branchId: dto.branchId !== undefined ? dto.branchId : undefined,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: { select: { id: true, name: true, code: true } }, extraPermissions: true, status: true, departmentId: true, branchId: true,
      },
    });

    if (roleChanged) {
      await this.auditService.log({
        actorId: admin.sub,
        action: AuditAction.USER_ROLE_CHANGED,
        metadata: { userId: id, oldRoleId: user.roleId, newRoleId: dto.roleId },
        ipAddress,
      });
    }

    await this.auditService.log({
      actorId: admin.sub,
      action: AuditAction.USER_UPDATED,
      metadata: { userId: id, changes: dto },
      ipAddress,
    });

    return updated;
  }

  /** Approve or reject a pending contractor account. */
  async changeStatus(
    id: string,
    status: string,
    reason: string | undefined,
    admin: JwtPayload,
    ipAddress: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    const action =
      status === UserStatus.ACTIVE
        ? AuditAction.CONTRACTOR_APPROVED
        : status === UserStatus.REJECTED
          ? AuditAction.CONTRACTOR_REJECTED
          : AuditAction.USER_STATUS_CHANGED;

    await this.auditService.log({
      actorId: admin.sub,
      action,
      metadata: { userId: id, oldStatus: user.status, newStatus: status, reason },
      ipAddress,
    });
  }

  async setupSignaturePin(userId: string, pin: string, ipAddress: string) {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestException('PIN must be 4 to 6 digits');
    }
    const hashedPin = await bcrypt.hash(pin, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { signaturePin: hashedPin },
    });
    
    await this.auditService.log({
      actorId: userId,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'SIGNATURE_PIN_SETUP' },
      ipAddress,
    });
  }

  async changeOwnPassword(userId: string, dto: ChangePasswordInput, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const currentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      throw new ForbiddenException('Current password is incorrect');
    }

    const samePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (samePassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePass: false,
      },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.USER_UPDATED,
      metadata: { action: 'PASSWORD_CHANGED' },
      ipAddress,
    });
  }

  async setupMfa(userId: string, email: string) {
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        mfaEnabled: false,
      },
    });

    return {
      secret,
      otpauthUri: createOtpAuthUri(secret, email),
    };
  }

  async enableMfa(userId: string, code: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new BadRequestException('MFA setup has not been started');
    }
    if (!verifyTotp(code, user.mfaSecret)) {
      throw new ForbiddenException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'MFA_ENABLED' },
      ipAddress,
    });
  }

  async disableMfa(userId: string, code: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret || !user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }
    if (!verifyTotp(code, user.mfaSecret)) {
      throw new ForbiddenException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.SYSTEM_CONFIG_CHANGED,
      metadata: { action: 'MFA_DISABLED' },
      ipAddress,
    });
  }

  /** List pending contractor registrations. */
  async getPendingContractors() {
    return this.prisma.user.findMany({
      where: { role: { code: 'CONTRACTOR' }, status: UserStatus.PENDING },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        companyName: true, phone: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
