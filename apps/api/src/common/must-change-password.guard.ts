import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './decorators';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_PATHS = new Set(['/api/users/me/password', '/api/auth/logout']);

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: { sub?: string } }>();
    if (SAFE_METHODS.has(request.method)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (ALLOWED_PATHS.has(request.path)) return true;

    const userId = request.user?.sub;
    if (!userId) return true;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mustChangePass: true },
    });

    if (user?.mustChangePass) {
      throw new ForbiddenException('Password change required before performing this action');
    }

    return true;
  }
}

