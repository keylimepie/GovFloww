// =============================================
// Workflow Service — DAG Definition Management
// =============================================

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, WorkflowStatus } from '@govflow/shared';
import type {
  CreateRoutingRuleInput,
  CreateStageInput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
} from '@govflow/shared';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Create a new workflow definition (DRAFT status).
   */
  async create(dto: CreateWorkflowInput, userId: string, ipAddress: string) {
    // Verify department exists
    const dept = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!dept) throw new NotFoundException('Department not found');

    const workflow = await this.prisma.workflowDefinition.create({
      data: {
        name: dto.name,
        description: dto.description || null,
        departmentId: dto.departmentId,
        version: 1,
        status: WorkflowStatus.DRAFT,
        createdBy: userId,
      },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.WORKFLOW_CREATED,
      metadata: { workflowId: workflow.id, name: workflow.name },
      ipAddress,
    });

    return workflow;
  }

  /**
   * Get all workflows (scoped by department for non-super-admins).
   */
  async findAll(departmentId?: string) {
    const where = departmentId ? { departmentId } : {};
    return this.prisma.workflowDefinition.findMany({
      where,
      include: {
        stages: {
          orderBy: { stageOrder: 'asc' },
          include: { assignedRole: { select: { id: true, name: true, code: true } } },
        },
        department: { select: { name: true, code: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get a single workflow with all stages and rules.
   */
  async findOne(id: string) {
    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { stageOrder: 'asc' },
          include: {
            routingRules: true,
            parallelConfig: true,
            assignedRole: { select: { id: true, name: true, code: true } },
          },
        },
        department: { select: { name: true, code: true } },
      },
    });

    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  /**
   * Update a workflow definition. If the workflow is ACTIVE, create a new version.
   */
  async update(
    id: string,
    dto: UpdateWorkflowInput,
    userId: string,
    ipAddress: string,
  ) {
    const existing = await this.prisma.workflowDefinition.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Workflow not found');

    // If already active, creating new version is a separate operation
    if (existing.status === WorkflowStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot directly edit an active workflow. Create a new version instead.',
      );
    }

    const updated = await this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
      },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.WORKFLOW_UPDATED,
      metadata: { workflowId: id, changes: dto },
      ipAddress,
    });

    return updated;
  }

  /**
   * Publish a draft workflow (set status to ACTIVE).
   */
  async publish(id: string, userId: string, ipAddress: string) {
    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: { stages: true },
    });

    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.status === WorkflowStatus.ACTIVE) {
      throw new BadRequestException('Workflow is already active');
    }
    if (workflow.stages.length === 0) {
      throw new BadRequestException('Workflow must have at least one stage');
    }

    const published = await this.prisma.workflowDefinition.update({
      where: { id },
      data: { status: WorkflowStatus.ACTIVE },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.WORKFLOW_PUBLISHED,
      metadata: { workflowId: id, name: workflow.name, version: workflow.version },
      ipAddress,
    });

    return published;
  }

  /**
   * Add a stage to a workflow definition.
   */
  async addStage(workflowId: string, dto: CreateStageInput, userId: string, ipAddress: string) {
    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.status === WorkflowStatus.ACTIVE) {
      throw new BadRequestException('Cannot add stages to an active workflow');
    }

    // Check for duplicate stage order
    const existingStage = await this.prisma.workflowStage.findUnique({
      where: {
        workflowId_stageOrder: {
          workflowId,
          stageOrder: dto.stageOrder,
        },
      },
    });
    if (existingStage) {
      throw new BadRequestException(`Stage order ${dto.stageOrder} already exists in this workflow`);
    }

    const stage = await this.prisma.workflowStage.create({
      data: {
        workflowId,
        name: dto.name,
        stageOrder: dto.stageOrder,
        stageType: dto.stageType,
        assignedRoleId: dto.assignedRoleId,
        slaDays: dto.slaDays,
        allowedActions: dto.allowedActions as string[],
        requiredDocs: dto.requiredDocs || [],
      },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.WORKFLOW_UPDATED,
      metadata: { workflowId, stageAdded: stage.name, stageOrder: stage.stageOrder },
      ipAddress,
    });

    return stage;
  }

  async addRoutingRule(
    workflowId: string,
    stageId: string,
    dto: CreateRoutingRuleInput,
    userId: string,
    ipAddress: string,
  ) {
    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { id: workflowId },
      include: { stages: true },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.status === WorkflowStatus.ACTIVE) {
      throw new BadRequestException('Cannot add routing rules to an active workflow');
    }

    const sourceStage = workflow.stages.find((stage) => stage.id === stageId);
    if (!sourceStage) throw new NotFoundException('Source stage not found in workflow');

    const targetStage = workflow.stages.find((stage) => stage.id === dto.targetStageId);
    if (!targetStage) throw new NotFoundException('Target stage not found in workflow');
    if (targetStage.id === sourceStage.id) {
      throw new BadRequestException('Routing rule target must be a different stage');
    }

    const rule = await this.prisma.stageRoutingRule.create({
      data: {
        stageId,
        conditionField: dto.conditionField,
        operator: dto.operator,
        value: dto.value,
        targetStageId: dto.targetStageId,
      },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.WORKFLOW_UPDATED,
      metadata: {
        workflowId,
        stageId,
        routingRuleId: rule.id,
        targetStageId: dto.targetStageId,
        conditionField: dto.conditionField,
        operator: dto.operator,
      },
      ipAddress,
    });

    return rule;
  }

  /**
   * Delete a stage from a draft workflow.
   */
  async removeStage(workflowId: string, stageId: string, userId: string, ipAddress: string) {
    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.status === WorkflowStatus.ACTIVE) {
      throw new BadRequestException('Cannot remove stages from an active workflow');
    }

    await this.prisma.workflowStage.delete({
      where: { id: stageId },
    });

    await this.auditService.log({
      actorId: userId,
      action: AuditAction.WORKFLOW_UPDATED,
      metadata: { workflowId, stageRemoved: stageId },
      ipAddress,
    });
  }
}
