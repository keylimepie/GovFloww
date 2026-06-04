// =============================================
// Workflows Controller
// =============================================

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { RolesGuard, PermissionsGuard } from '../common/guards';
import { Roles, RequirePermissions, CurrentUser, ClientIp } from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes';
import {
  Role,
  INTERNAL_ROLES,
  CreateWorkflowSchema,
  CreateRoutingRuleSchema,
  CreateStageSchema,
  UpdateWorkflowSchema,
} from '@govflow/shared';
import type {
  CreateRoutingRuleInput,
  CreateWorkflowInput,
  CreateStageInput,
  UpdateWorkflowInput,
  JwtPayload,
} from '@govflow/shared';

@Controller('api/workflows')
@UseGuards(RolesGuard, PermissionsGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  @RequirePermissions('workflow:create')
  async create(
    @Body(new ZodValidationPipe(CreateWorkflowSchema)) dto: CreateWorkflowInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const workflow = await this.workflowsService.create(dto, user.sub, ip);
    return { success: true, data: workflow };
  }

  @Get()
  @Roles(...INTERNAL_ROLES)
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('departmentId') departmentId?: string,
  ) {
    // Non-super-admins can only see their department's workflows
    const deptFilter =
      user.role === Role.SUPER_ADMIN
        ? departmentId
        : user.departmentId || undefined;

    const workflows = await this.workflowsService.findAll(deptFilter);
    return { success: true, data: workflows };
  }

  @Get(':id')
  @Roles(...INTERNAL_ROLES)
  async findOne(@Param('id') id: string) {
    const workflow = await this.workflowsService.findOne(id);
    return { success: true, data: workflow };
  }

  @Put(':id')
  @RequirePermissions('workflow:update')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWorkflowSchema)) dto: UpdateWorkflowInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const workflow = await this.workflowsService.update(id, dto, user.sub, ip);
    return { success: true, data: workflow };
  }

  @Post(':id/publish')
  @RequirePermissions('workflow:publish')
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const workflow = await this.workflowsService.publish(id, user.sub, ip);
    return { success: true, data: workflow };
  }

  @Post(':id/stages')
  @RequirePermissions('workflow:update')
  async addStage(
    @Param('id') workflowId: string,
    @Body(new ZodValidationPipe(CreateStageSchema)) dto: CreateStageInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const stage = await this.workflowsService.addStage(workflowId, dto, user.sub, ip);
    return { success: true, data: stage };
  }

  @Post(':workflowId/stages/:stageId/routing-rules')
  @RequirePermissions('workflow:update')
  async addRoutingRule(
    @Param('workflowId') workflowId: string,
    @Param('stageId') stageId: string,
    @Body(new ZodValidationPipe(CreateRoutingRuleSchema)) dto: CreateRoutingRuleInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const rule = await this.workflowsService.addRoutingRule(workflowId, stageId, dto, user.sub, ip);
    return { success: true, data: rule };
  }

  @Delete(':workflowId/stages/:stageId')
  @RequirePermissions('workflow:update')
  async removeStage(
    @Param('workflowId') workflowId: string,
    @Param('stageId') stageId: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    await this.workflowsService.removeStage(workflowId, stageId, user.sub, ip);
    return { success: true, message: 'Stage removed' };
  }
}
