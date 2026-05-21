import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/guards';
import { ClientIp, CurrentUser, RequirePermissions } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes';
import {
  CreateBranchSchema,
  CreateDepartmentSchema,
  UpdateBranchSchema,
  UpdateDepartmentSchema,
} from '@govflow/shared';
import type {
  CreateBranchInput,
  CreateDepartmentInput,
  JwtPayload,
  UpdateBranchInput,
  UpdateDepartmentInput,
} from '@govflow/shared';
import { OrganisationService } from './organisation.service';

@Controller('api/organisation')
@UseGuards(PermissionsGuard)
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Get('departments')
  @RequirePermissions('*', 'org:manage_branches', 'workflow:create')
  async listDepartments(@CurrentUser() user: JwtPayload) {
    const data = await this.organisationService.listDepartments(user);
    return { success: true, data };
  }

  @Post('departments')
  @RequirePermissions('*')
  async createDepartment(
    @Body(new ZodValidationPipe(CreateDepartmentSchema)) dto: CreateDepartmentInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.organisationService.createDepartment(dto, user, ip);
    return { success: true, data };
  }

  @Patch('departments/:id')
  @RequirePermissions('*')
  async updateDepartment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDepartmentSchema)) dto: UpdateDepartmentInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.organisationService.updateDepartment(id, dto, user, ip);
    return { success: true, data };
  }

  @Get('branches')
  @RequirePermissions('*', 'org:manage_branches', 'user:view_branch')
  async listBranches(@CurrentUser() user: JwtPayload) {
    const data = await this.organisationService.listBranches(user);
    return { success: true, data };
  }

  @Post('branches')
  @RequirePermissions('*', 'org:manage_branches')
  async createBranch(
    @Body(new ZodValidationPipe(CreateBranchSchema)) dto: CreateBranchInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.organisationService.createBranch(dto, user, ip);
    return { success: true, data };
  }

  @Patch('branches/:id')
  @RequirePermissions('*', 'org:manage_branches')
  async updateBranch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBranchSchema)) dto: UpdateBranchInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.organisationService.updateBranch(id, dto, user, ip);
    return { success: true, data };
  }
}
