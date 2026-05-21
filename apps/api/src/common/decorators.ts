// =============================================
// Custom Decorators for RBAC & Request Context
// =============================================

import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

// ---- Role-based access decorator ----
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// ---- Permission-based access decorator ----
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// ---- Extract current user from request ----
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// ---- Extract client IP ----
export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      request.ip ||
      'unknown'
    );
  },
);

// ---- Public route (skip auth) ----
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
