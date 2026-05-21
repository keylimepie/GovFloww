import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesGuard, PermissionsGuard } from '../common/guards';
import { RequirePermissions, CurrentUser, ClientIp } from '../common/decorators';
import { JwtPayload } from '@govflow/shared';

@Controller('api/roles')
@UseGuards(RolesGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('system:config', 'user:create', 'user:update')
  async findAll() {
    const roles = await this.rolesService.findAll();
    return { success: true, data: roles };
  }

  @Post()
  @RequirePermissions('system:config')
  async create(
    @Body() dto: { name: string; code: string; hierarchyLevel: number; permissions: string[] },
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    dto.hierarchyLevel = Number(dto.hierarchyLevel);
    const role = await this.rolesService.create(dto, user, ip);
    return { success: true, data: role };
  }

  @Put('reorder')
  @RequirePermissions('system:config')
  async reorder(
    @Body() updates: { id: string; hierarchyLevel: number }[],
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const parsedUpdates = updates.map(u => ({ ...u, hierarchyLevel: Number(u.hierarchyLevel) }));
    await this.rolesService.reorder(parsedUpdates, user, ip);
    return { success: true, message: 'Roles reordered' };
  }

  @Put(':id')
  @RequirePermissions('system:config')
  async update(
    @Param('id') id: string,
    @Body() dto: { name?: string; permissions?: string[]; hierarchyLevel?: number },
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    if (dto.hierarchyLevel !== undefined) {
      dto.hierarchyLevel = Number(dto.hierarchyLevel);
    }
    const role = await this.rolesService.update(id, dto, user, ip);
    return { success: true, data: role };
  }

  @Delete(':id')
  @RequirePermissions('system:config')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    await this.rolesService.remove(id, user, ip);
    return { success: true, message: 'Role deleted' };
  }
}
