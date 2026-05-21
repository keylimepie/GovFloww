// =============================================
// Auth Service — JWT Authentication
// =============================================

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role, UserStatus, AuditAction, JwtPayload } from '@govflow/shared';
import type { LoginInput, RegisterInput } from '@govflow/shared';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { verifyTotp } from './totp';

const BCRYPT_ROUNDS = 12;
type AuthenticatedUserRecord = Prisma.UserGetPayload<{
  include: { department: true; branch: true; role: true };
}>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  /**
   * Authenticate user with email + password.
   * Returns JWT access token + refresh token.
   */
  async login(dto: LoginInput, ipAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { department: true, branch: true, role: true },
    });

    if (!user) {
      // Constant-time comparison to prevent timing attacks
      await bcrypt.hash('dummy', BCRYPT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account status
    if (user.status !== UserStatus.ACTIVE) {
      await this.auditService.log({
        actorId: user.id,
        action: AuditAction.USER_LOGIN_FAILED,
        metadata: { reason: `Account status: ${user.status}` },
        ipAddress,
      });

      if (user.status === UserStatus.PENDING) {
        throw new UnauthorizedException('Account is pending approval');
      }
      throw new UnauthorizedException('Account is suspended or inactive');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.auditService.log({
        actorId: user.id,
        action: AuditAction.USER_LOGIN_FAILED,
        metadata: { reason: 'Invalid password' },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.mfaEnabled) {
      if (!user.mfaSecret || !verifyTotp(dto.mfaCode, user.mfaSecret)) {
        await this.auditService.log({
          actorId: user.id,
          action: AuditAction.USER_LOGIN_FAILED,
          metadata: { reason: 'Invalid MFA code' },
          ipAddress,
        });
        throw new UnauthorizedException('MFA code is required or invalid');
      }
    }

    const effectivePermissions = this.mergePermissions(user.role.permissions, user.extraPermissions);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roleId: user.role.id,
      role: user.role.code,
      permissions: effectivePermissions,
      extraPermissions: user.extraPermissions,
      hierarchyLevel: user.role.hierarchyLevel,
      departmentId: user.departmentId,
      branchId: user.branchId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRY', '15m'),
    });

    const refreshToken = await this.createRefreshToken(user.id, ipAddress);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Audit log
    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_LOGIN,
      metadata: { email: user.email },
      ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      user: this.toSessionUser(user, effectivePermissions),
    };
  }

  async getSessionUser(userId: string) {
    const user = await this.findActiveUserForSession(userId);
    if (!user) {
      throw new UnauthorizedException('User account is no longer active');
    }

    const effectivePermissions = this.mergePermissions(user.role.permissions, user.extraPermissions);
    return this.toSessionUser(user, effectivePermissions);
  }

  /**
   * Register a new contractor account (status = PENDING).
   */
  async register(dto: RegisterInput, ipAddress: string) {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const contractorRole = await this.prisma.role.findUnique({
      where: { code: 'CONTRACTOR' },
    });
    if (!contractorRole) throw new BadRequestException('Contractor role not found in system.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: contractorRole.id,
        status: UserStatus.PENDING,
        companyName: dto.companyName || null,
        phone: dto.phone || null,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: AuditAction.USER_REGISTERED,
      metadata: { email: user.email, role: Role.CONTRACTOR },
      ipAddress,
    });

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      message: 'Registration successful. Your account is pending admin approval.',
    };
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshAccessToken(refreshTokenValue: string, ipAddress: string) {
    const tokenHash = this.hashRefreshToken(refreshTokenValue);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: { role: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is no longer active');
    }

    // Revoke old refresh token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Issue new tokens
    const effectivePermissions = this.mergePermissions(user.role.permissions, user.extraPermissions);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roleId: user.role.id,
      role: user.role.code,
      permissions: effectivePermissions,
      extraPermissions: user.extraPermissions,
      hierarchyLevel: user.role.hierarchyLevel,
      departmentId: user.departmentId,
      branchId: user.branchId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRY', '15m'),
    });

    const newRefreshToken = await this.createRefreshToken(user.id, ipAddress);

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Revoke a refresh token (logout).
   */
  async logout(refreshTokenValue: string, userId: string, ipAddress: string) {
    const tokenHash = refreshTokenValue ? this.hashRefreshToken(refreshTokenValue) : '';
    await this.prisma.refreshToken.updateMany({
      where: { token: tokenHash, userId },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.USER_LOGOUT,
      metadata: {},
      ipAddress,
    });
  }

  // ---- Private helpers ----

  private async createRefreshToken(userId: string, ipAddress: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8-hour refresh token

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: this.hashRefreshToken(token),
        expiresAt,
        ipAddress,
      },
    });

    return token;
  }

  private mergePermissions(rolePermissions: string[], extraPermissions: string[]) {
    return Array.from(new Set([...rolePermissions, ...extraPermissions]));
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async findActiveUserForSession(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      include: { department: true, branch: true, role: true },
    });
  }

  private toSessionUser(user: AuthenticatedUserRecord, effectivePermissions: string[]) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.code,
      permissions: effectivePermissions,
      extraPermissions: user.extraPermissions,
      hierarchyLevel: user.role.hierarchyLevel,
      departmentId: user.departmentId,
      departmentName: user.department?.name || null,
      branchId: user.branchId,
      branchName: user.branch?.name || null,
      mfaEnabled: user.mfaEnabled,
      mustChangePassword: user.mustChangePass,
    };
  }
}
