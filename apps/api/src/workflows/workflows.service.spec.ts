import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, WorkflowStatus } from '@govflow/shared';
import { WorkflowsService } from './workflows.service';

describe('WorkflowsService routing rules', () => {
  it('adds a routing rule to a draft workflow and audits it', async () => {
    const prisma = {
      workflowDefinition: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'workflow-1',
          status: WorkflowStatus.DRAFT,
          stages: [{ id: 'stage-sde' }, { id: 'stage-se' }],
        }),
      },
      stageRoutingRule: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'rule-1' }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new WorkflowsService(prisma as any, audit as any);

    await expect(
      service.addRoutingRule(
        'workflow-1',
        'stage-sde',
        {
          conditionField: 'vo_percentage',
          operator: 'gte',
          value: '10',
          targetStageId: 'stage-se',
        },
        'admin-1',
        '127.0.0.1',
      ),
    ).resolves.toMatchObject({ id: 'rule-1' });

    expect(prisma.stageRoutingRule.create).toHaveBeenCalledWith({
      data: {
        stageId: 'stage-sde',
        conditionField: 'vo_percentage',
        operator: 'gte',
        value: '10',
        targetStageId: 'stage-se',
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: AuditAction.WORKFLOW_UPDATED,
        metadata: expect.objectContaining({ routingRuleId: 'rule-1' }),
      }),
    );
  });

  it('blocks routing rule edits on active workflows', async () => {
    const service = new WorkflowsService(
      {
        workflowDefinition: {
          findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
            id: 'workflow-1',
            status: WorkflowStatus.ACTIVE,
            stages: [{ id: 'stage-sde' }, { id: 'stage-se' }],
          }),
        },
      } as any,
      {} as any,
    );

    await expect(
      service.addRoutingRule(
        'workflow-1',
        'stage-sde',
        {
          conditionField: 'vo_percentage',
          operator: 'gte',
          value: '10',
          targetStageId: 'stage-se',
        },
        'admin-1',
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires routing targets to belong to the workflow', async () => {
    const service = new WorkflowsService(
      {
        workflowDefinition: {
          findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
            id: 'workflow-1',
            status: WorkflowStatus.DRAFT,
            stages: [{ id: 'stage-sde' }],
          }),
        },
      } as any,
      {} as any,
    );

    await expect(
      service.addRoutingRule(
        'workflow-1',
        'stage-sde',
        {
          conditionField: 'vo_percentage',
          operator: 'gte',
          value: '10',
          targetStageId: 'stage-missing',
        },
        'admin-1',
        '127.0.0.1',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
