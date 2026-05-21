// =============================================
// RBAC Guards — Role & Permission Enforcement
// =============================================

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PERMISSIONS_KEY, IS_PUBLIC_KEY } from './decorators';

/**
 * RolesGuard: Checks if the user's role is in the allowed roles list.
 * Usage: @Roles(Role.SUPER_ADMIN, Role.DEPARTMENT_ADMIN)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no valid user context');
    }

    // Super Admin bypasses all role checks
    if (user.role === 'SUPER_ADMIN') return true;

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      this.logger.warn(
        `Access denied: user ${user.sub} with role ${user.role} attempted to access route requiring ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException('Access denied: insufficient role');
    }

    return true;
  }
}

/**
 * PermissionsGuard: Checks granular permissions from the JWT role record.
 * Usage: @RequirePermissions('submission:forward', 'submission:comment')
 * Multiple permissions are treated as alternatives. Use multiple decorators/routes
 * for workflows that require every permission in a set.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no valid user context');
    }

    const userPermissions = user.permissions || [];
    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes('*') || userPermissions.includes(perm),
    );

    if (!hasPermission) {
      this.logger.warn(
        `Permission denied: user ${user.sub} (${user.role}) lacks any of: ${requiredPermissions.join(', ')}`,
      );
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}
