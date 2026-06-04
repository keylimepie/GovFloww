import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditAction, SubmissionStatus } from '@govflow/shared';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService signature verification', () => {
  const secret = 'signature-test-secret'.repeat(4);
  const documentHash = crypto.createHash('sha256').update('immutable signed payload').digest('hex');
  const signatureData = crypto.createHmac('sha256', secret).update(documentHash + 'officer-1').digest('hex');

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });

  it('verifies using the stored immutable hash and returns sanitized public data', async () => {
    const prisma = {
      digitalSignature: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'sig-1',
          officerId: 'officer-1',
          tier: 1,
          documentHash,
          signatureData,
          createdAt: new Date('2026-05-16T10:00:00.000Z'),
          officer: {
            firstName: 'Hidden',
            lastName: 'Officer',
            role: { name: 'Engineer' },
            department: { name: 'Hidden Department' },
          },
          submission: {
            trackingNumber: '2026-PWD-0001',
            title: 'BOQ Approval',
            updatedAt: new Date('2099-01-01T00:00:00.000Z'),
          },
        }),
      },
    };

    const service = new SubmissionsService(prisma as any, {} as any, {} as any);
    const result = await service.verifySignature('sig-1');

    expect(result.isValid).toBe(true);
    expect(result).toMatchObject({
      role: 'Engineer',
      trackingNumber: '2026-PWD-0001',
      documentTitle: 'BOQ Approval',
    });
    expect(result).not.toHaveProperty('officerName');
    expect(result).not.toHaveProperty('department');
  });

  it('does not attach unaudited presigned URLs or storage keys on submission detail', async () => {
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'submission-1',
          contractorId: 'contractor-1',
          branchId: 'branch-1',
          workflow: { departmentId: 'dept-1', stages: [] },
          fileStages: [],
          comments: [],
          signatures: [],
          documents: [
            {
              id: 'doc-1',
              originalName: 'boq.pdf',
              mimeType: 'application/pdf',
              sizeBytes: BigInt(1024),
              storageKey: 'submissions/secret/boq.pdf',
              createdAt: new Date('2026-05-20T00:00:00.000Z'),
            },
          ],
        }),
      },
    };
    const storage = { getPresignedUrl: jest.fn<() => Promise<string>>() };
    const service = new SubmissionsService(prisma as any, {} as any, storage as any);

    const result = await service.findOne('submission-1', {
      sub: 'admin-1',
      email: 'admin@govflow.gov.np',
      roleId: 'role-1',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
      hierarchyLevel: 100,
      departmentId: null,
      branchId: null,
    });

    expect(storage.getPresignedUrl).not.toHaveBeenCalled();
    expect(result.documents[0]).toMatchObject({ id: 'doc-1', url: null, sizeBytes: 1024 });
    expect(result.documents[0]).not.toHaveProperty('storageKey');
  });

  it('hides submissions from public tracking until explicitly enabled', async () => {
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'submission-1',
          trackingNumber: '2026-PWD-0001',
          publicTrackable: false,
          workflow: { name: 'BOQ Approval' },
          fileStages: [],
        }),
      },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    await expect(service.track('2026-PWD-0001')).rejects.toThrow('Tracking number not found');
  });

  it('returns public-safe tracking detail with expected completion from active SLA', async () => {
    const slaDueAt = new Date('2099-01-10T00:00:00.000Z');
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'submission-1',
          trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
          title: 'Variation order approval',
          status: SubmissionStatus.IN_REVIEW,
          publicTrackable: true,
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          workflow: { name: 'DOR Variation Order Approval' },
          fileStages: [
            {
              id: 'file-stage-1',
              status: 'COMPLETED',
              startedAt: new Date('2026-06-01T00:00:00.000Z'),
              completedAt: new Date('2026-06-02T00:00:00.000Z'),
              slaDueAt: new Date('2026-06-03T00:00:00.000Z'),
              stage: { name: 'Entry Desk', stageOrder: 1 },
            },
            {
              id: 'file-stage-2',
              status: 'PENDING',
              startedAt: new Date('2026-06-02T00:00:00.000Z'),
              completedAt: null,
              slaDueAt,
              stage: { name: 'Engineer Review', stageOrder: 2 },
            },
          ],
        }),
      },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    const result = await service.track('DOR/RD-KTM/2082-83/VO/0001');

    expect(result).toMatchObject({
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
      workflowName: 'DOR Variation Order Approval',
      expectedCompletionAt: slaDueAt,
      currentStep: {
        stageName: 'Engineer Review',
        status: 'PENDING',
      },
    });
    expect(result).not.toHaveProperty('documents');
    expect(result).not.toHaveProperty('comments');
    expect(result).not.toHaveProperty('assignedOfficer');
  });

  it('updates public tracking visibility and audits the change', async () => {
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'submission-1',
          publicTrackable: false,
          branchId: 'branch-1',
          contractorId: 'contractor-1',
          workflow: { departmentId: 'dept-1' },
        }),
        update: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'submission-1',
          publicTrackable: true,
        }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new SubmissionsService(prisma as any, audit as any, {} as any);

    await expect(
      service.updatePublicTracking(
        'submission-1',
        true,
        {
          sub: 'admin-1',
          email: 'admin@govflow.gov.np',
          roleId: 'role-1',
          role: 'DEPARTMENT_ADMIN',
          permissions: ['submission:manage_public_tracking'],
          hierarchyLevel: 80,
          departmentId: 'dept-1',
          branchId: null,
        },
        '127.0.0.1',
      ),
    ).resolves.toMatchObject({ publicTrackable: true });

    expect(prisma.fileSubmission.update).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
      data: { publicTrackable: true },
    });
    expect(audit.log).toHaveBeenCalledWith({
      submissionId: 'submission-1',
      actorId: 'admin-1',
      action: AuditAction.PUBLIC_TRACKING_CHANGED,
      metadata: { previousValue: false, newValue: true },
      ipAddress: '127.0.0.1',
    });
  });

  it('requires metadata declared by the selected workflow schema', async () => {
    const prisma = {
      branch: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'branch-1',
          code: 'RD-KTM',
          departmentId: 'dept-1',
        }),
      },
      workflowDefinition: {
        findFirst: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'workflow-1',
          code: 'VO',
          name: 'DOR Variation Order Approval',
          version: 1,
          status: 'ACTIVE',
          department: { id: 'dept-1', code: 'DOR' },
          departmentId: 'dept-1',
          metadataSchema: [
            { key: 'contract_number', label: 'Contract Number', type: 'TEXT', required: true },
            { key: 'vo_percentage', label: 'VO Percentage', type: 'NUMBER', required: true },
          ],
          stages: [{ id: 'stage-entry', stageOrder: 1, slaDays: 1 }],
        }),
      },
      fileSubmission: {
        create: jest.fn<() => Promise<any>>(),
      },
      $transaction: jest.fn<() => Promise<any>>(),
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    await expect(
      service.create(
        {
          submissionType: 'VO',
          branchId: 'branch-1',
          title: 'VO request',
          metadata: { contract_number: 'DOR-123' },
        },
        {
          sub: 'contractor-1',
          email: 'contractor@example.com',
          roleId: 'role-contractor',
          role: 'CONTRACTOR',
          permissions: ['submission:create'],
          hierarchyLevel: 10,
          departmentId: null,
          branchId: null,
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow('VO Percentage is required');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('normalizes numeric workflow metadata before creating a submission', async () => {
    const createdSubmission = { id: 'submission-1', trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001' };
    const tx = {
      fileSubmission: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue(createdSubmission),
      },
      fileStage: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'file-stage-1' }),
      },
    };
    const prisma = {
      branch: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'branch-1',
          code: 'RD-KTM',
          departmentId: 'dept-1',
        }),
      },
      workflowDefinition: {
        findFirst: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'workflow-1',
          code: 'VO',
          name: 'DOR Variation Order Approval',
          version: 1,
          status: 'ACTIVE',
          department: { id: 'dept-1', code: 'DOR' },
          departmentId: 'dept-1',
          metadataSchema: [
            { key: 'contract_number', label: 'Contract Number', type: 'TEXT', required: true },
            { key: 'vo_percentage', label: 'VO Percentage', type: 'NUMBER', required: true },
          ],
          stages: [{ id: 'stage-entry', stageOrder: 1, slaDays: 1 }],
        }),
      },
      dorTrackingSequence: {
        upsert: jest.fn<() => Promise<any>>().mockResolvedValue({ lastNumber: 1 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new SubmissionsService(prisma as any, audit as any, {} as any);

    await expect(
      service.create(
        {
          submissionType: 'VO',
          branchId: 'branch-1',
          title: 'VO request',
          metadata: { contract_number: ' DOR-123 ', vo_percentage: '12.5' },
        },
        {
          sub: 'contractor-1',
          email: 'contractor@example.com',
          roleId: 'role-contractor',
          role: 'CONTRACTOR',
          permissions: ['submission:create'],
          hierarchyLevel: 10,
          departmentId: null,
          branchId: null,
        },
        '127.0.0.1',
      ),
    ).resolves.toMatchObject(createdSubmission);

    expect(tx.fileSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { contract_number: 'DOR-123', vo_percentage: 12.5 },
        }),
      }),
    );
  });

  it('blocks forwarding from a stage that requires Tippani until Tippani is prepared', async () => {
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'submission-1',
          currentStageId: 'stage-engineer',
          workflowId: 'workflow-1',
          workflowVersion: 1,
          trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
          title: 'VO request',
          contractorId: 'contractor-1',
          branchId: 'branch-1',
          metadata: { vo_percentage: 9 },
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
          workflow: {
            code: 'VO',
            departmentId: 'dept-1',
            stages: [
              {
                id: 'stage-engineer',
                name: 'Engineer - Tippani',
                stageOrder: 3,
                stageType: 'SEQUENTIAL',
                assignedRoleId: 'role-engineer',
                assignedRole: { code: 'ENGINEER', name: 'Engineer' },
                allowedActions: ['FORWARD'],
                requiredDocs: ['TIPPANI'],
                slaDays: 3,
              },
            ],
          },
          documents: [],
        }),
      },
      fileStage: {
        findFirst: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'file-stage-1' }),
      },
      tippaniMetadata: {
        count: jest.fn<() => Promise<number>>().mockResolvedValue(0),
      },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    await expect(
      service.forward(
        'submission-1',
        { comment: 'Forwarding after review' },
        {
          sub: 'engineer-1',
          email: 'engineer@dor.gov.np',
          roleId: 'role-engineer',
          role: 'ENGINEER',
          permissions: ['submission:forward'],
          hierarchyLevel: 50,
          departmentId: 'dept-1',
          branchId: 'branch-1',
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.tippaniMetadata.count).toHaveBeenCalledWith({
      where: {
        submissionId: 'submission-1',
        fileStage: { stageId: 'stage-engineer' },
      },
    });
  });

  it('auto-approves a DOR VO under 10 percent when forwarded by SDE', async () => {
    const currentSubmission = {
      id: 'submission-1',
      currentStageId: 'stage-sde',
      workflowId: 'workflow-1',
      workflowVersion: 1,
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
      title: 'VO request',
      contractorId: 'contractor-1',
      branchId: 'branch-1',
      metadata: { vo_percentage: 9 },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      workflow: {
        code: 'VO',
        departmentId: 'dept-1',
        stages: [
          {
            id: 'stage-sde',
            name: 'SDE - Review and Decision',
            stageOrder: 4,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-sde',
            assignedRole: { code: 'SENIOR_ENGINEER', name: 'Senior Engineer' },
            allowedActions: ['FORWARD', 'APPROVE'],
            requiredDocs: [],
            slaDays: 3,
          },
          {
            id: 'stage-se',
            name: 'SE - Review',
            stageOrder: 5,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-se',
            assignedRole: { code: 'SUPERINTENDENT_ENGINEER', name: 'Superintending Engineer' },
            allowedActions: ['APPROVE'],
            requiredDocs: [],
            slaDays: 3,
          },
        ],
      },
      documents: [],
    };
    const detailSubmission = {
      ...currentSubmission,
      currentStageId: null,
      status: SubmissionStatus.APPROVED,
      fileStages: [],
      comments: [],
      signatures: [],
      documents: [],
      branch: {},
      contractor: {},
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce(currentSubmission)
          .mockResolvedValueOnce(detailSubmission),
        update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'submission-1' }),
      },
      fileStage: {
        updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new SubmissionsService(prisma as any, audit as any, {} as any);

    await service.forward(
      'submission-1',
      { comment: 'Within SDE approval threshold' },
      {
        sub: 'sde-1',
        email: 'sde@dor.gov.np',
        roleId: 'role-sde',
        role: 'SENIOR_ENGINEER',
        permissions: ['submission:forward'],
        hierarchyLevel: 60,
        departmentId: 'dept-1',
        branchId: 'branch-1',
      },
      '127.0.0.1',
    );

    expect(prisma.fileSubmission.update).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
      data: {
        currentStageId: null,
        status: SubmissionStatus.APPROVED,
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.FILE_APPROVED,
        metadata: expect.objectContaining({ thresholdApproved: true }),
      }),
    );
  });

  it('uses configured routing rules when forwarding a DOR VO above the SDE threshold', async () => {
    const currentSubmission = {
      id: 'submission-1',
      currentStageId: 'stage-sde',
      workflowId: 'workflow-1',
      workflowVersion: 1,
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0011',
      title: 'VO request',
      contractorId: 'contractor-1',
      branchId: 'branch-1',
      currentBranchId: 'branch-1',
      metadata: { vo_percentage: 12 },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      workflow: {
        code: 'VO',
        departmentId: 'dept-1',
        stages: [
          {
            id: 'stage-sde',
            name: 'SDE - Review and Decision',
            stageOrder: 4,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-sde',
            assignedRole: { code: 'SENIOR_ENGINEER', name: 'Senior Engineer' },
            allowedActions: ['FORWARD'],
            requiredDocs: [],
            routingRules: [
              {
                conditionField: 'vo_percentage',
                operator: 'gte',
                value: '10',
                targetStageId: 'stage-se',
              },
            ],
            slaDays: 3,
          },
          {
            id: 'stage-se',
            name: 'SE - Review',
            stageOrder: 6,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-se',
            assignedRole: { code: 'SUPERINTENDENT_ENGINEER', name: 'Superintending Engineer' },
            allowedActions: ['FORWARD', 'APPROVE'],
            requiredDocs: [],
            routingRules: [],
            slaDays: 5,
          },
        ],
      },
      documents: [],
      fileStages: [{ id: 'file-stage-sde', stageId: 'stage-sde', assignedTo: 'sde-1' }],
    };
    const detailSubmission = {
      ...currentSubmission,
      currentStageId: 'stage-se',
      status: SubmissionStatus.IN_REVIEW,
      fileStages: [],
      comments: [],
      signatures: [],
      documents: [],
      branch: {},
      currentBranch: {},
      contractor: {},
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce(currentSubmission)
          .mockResolvedValueOnce(detailSubmission),
        update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'submission-1' }),
      },
      fileStage: {
        updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
        create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'file-stage-se' }),
      },
      branch: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ departmentId: 'dept-1' }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new SubmissionsService(prisma as any, audit as any, {} as any);

    await service.forward(
      'submission-1',
      { comment: 'Route by VO threshold' },
      {
        sub: 'sde-1',
        email: 'sde@dor.gov.np',
        roleId: 'role-sde',
        role: 'SENIOR_ENGINEER',
        permissions: ['submission:forward'],
        hierarchyLevel: 60,
        departmentId: 'dept-1',
        branchId: 'branch-1',
      },
      '127.0.0.1',
    );

    expect(prisma.fileStage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submissionId: 'submission-1',
        stageId: 'stage-se',
        branchId: 'branch-1',
        status: 'PENDING',
      }),
    });
    expect(prisma.fileSubmission.update).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
      data: {
        currentStageId: 'stage-se',
        currentBranchId: 'branch-1',
        status: SubmissionStatus.IN_REVIEW,
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.FILE_FORWARDED,
        metadata: expect.objectContaining({
          fromStage: 'SDE - Review and Decision',
          toStage: 'SE - Review',
        }),
      }),
    );
  });

  it('returns server-approved available actions and forward targets', async () => {
    const currentSubmission = {
      id: 'submission-1',
      currentStageId: 'stage-sde',
      workflowId: 'workflow-1',
      workflowVersion: 1,
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0012',
      title: 'VO request',
      contractorId: 'contractor-1',
      branchId: 'branch-child',
      currentBranchId: 'branch-child',
      metadata: { vo_percentage: 12 },
      workflow: {
        code: 'VO',
        departmentId: 'dept-1',
        stages: [
          {
            id: 'stage-sde',
            name: 'SDE - Review and Decision',
            stageOrder: 5,
            assignedRoleId: 'role-sde',
            assignedRole: { id: 'role-sde', code: 'SENIOR_ENGINEER', name: 'Senior Engineer' },
            allowedActions: ['FORWARD', 'APPROVE', 'TOK', 'RAYE'],
            routingRules: [
              { conditionField: 'vo_percentage', operator: 'gte', value: '10', targetStageId: 'stage-se' },
            ],
          },
          {
            id: 'stage-se',
            name: 'SE - Review',
            stageOrder: 6,
            assignedRoleId: 'role-se',
            assignedRole: { id: 'role-se', code: 'SUPERINTENDENT_ENGINEER', name: 'Superintending Engineer' },
            allowedActions: ['FORWARD', 'APPROVE'],
            routingRules: [],
          },
        ],
      },
      documents: [],
      fileStages: [{ id: 'file-stage-sde', stageId: 'stage-sde', assignedTo: 'sde-1' }],
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(currentSubmission),
      },
      branch: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce({ id: 'branch-child', parentBranchId: 'branch-parent' })
          .mockResolvedValueOnce({ id: 'branch-parent', parentBranchId: null }),
        findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
          { id: 'branch-child', name: 'Road Division Kathmandu', code: 'RD-KTM', branchLevel: 1, clusterType: 'ROAD_DIVISION' },
          { id: 'branch-parent', name: 'FRSMO Kathmandu', code: 'FRSMO-KTM', branchLevel: 2, clusterType: 'FRSMO' },
        ]),
      },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    await expect(
      service.availableActions('submission-1', {
        sub: 'sde-1',
        email: 'sde@dor.gov.np',
        roleId: 'role-sde',
        role: 'SENIOR_ENGINEER',
        permissions: ['submission:forward', 'submission:approve', 'submission:tok_assign', 'submission:raye_request'],
        hierarchyLevel: 60,
        departmentId: 'dept-1',
        branchId: 'branch-child',
      }),
    ).resolves.toMatchObject({
      canAct: true,
      actions: expect.arrayContaining([
        expect.objectContaining({
          action: 'FORWARD',
          targets: expect.arrayContaining([
            expect.objectContaining({
              targetStageId: 'stage-se',
              targetBranchId: 'branch-parent',
              recommended: true,
            }),
          ]),
        }),
      ]),
    });
  });

  it('blocks explicit forwarding to offices outside the available route policy', async () => {
    const currentSubmission = {
      id: 'submission-1',
      currentStageId: 'stage-sde',
      workflowId: 'workflow-1',
      workflowVersion: 1,
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0013',
      title: 'VO request',
      contractorId: 'contractor-1',
      branchId: 'branch-child',
      currentBranchId: 'branch-child',
      metadata: { vo_percentage: 12 },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      workflow: {
        code: 'VO',
        departmentId: 'dept-1',
        stages: [
          {
            id: 'stage-sde',
            name: 'SDE - Review and Decision',
            stageOrder: 5,
            assignedRoleId: 'role-sde',
            assignedRole: { id: 'role-sde', code: 'SENIOR_ENGINEER', name: 'Senior Engineer' },
            allowedActions: ['FORWARD'],
            requiredDocs: [],
            routingRules: [
              { conditionField: 'vo_percentage', operator: 'gte', value: '10', targetStageId: 'stage-se' },
            ],
            slaDays: 3,
          },
          {
            id: 'stage-se',
            name: 'SE - Review',
            stageOrder: 6,
            assignedRoleId: 'role-se',
            assignedRole: { id: 'role-se', code: 'SUPERINTENDENT_ENGINEER', name: 'Superintending Engineer' },
            allowedActions: ['FORWARD', 'APPROVE'],
            requiredDocs: [],
            routingRules: [],
            slaDays: 5,
          },
        ],
      },
      documents: [],
      fileStages: [{ id: 'file-stage-sde', stageId: 'stage-sde', assignedTo: 'sde-1' }],
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(currentSubmission),
        update: jest.fn<() => Promise<any>>(),
      },
      fileStage: {
        updateMany: jest.fn<() => Promise<any>>(),
        create: jest.fn<() => Promise<any>>(),
      },
      branch: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce({ id: 'branch-child', parentBranchId: 'branch-parent' })
          .mockResolvedValueOnce({ id: 'branch-parent', parentBranchId: null }),
        findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
          { id: 'branch-child', name: 'Road Division Kathmandu', code: 'RD-KTM', branchLevel: 1, clusterType: 'ROAD_DIVISION' },
          { id: 'branch-parent', name: 'FRSMO Kathmandu', code: 'FRSMO-KTM', branchLevel: 2, clusterType: 'FRSMO' },
        ]),
      },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    await expect(
      service.forward(
        'submission-1',
        { targetStageId: 'stage-se', targetBranchId: 'branch-other', comment: 'Send elsewhere' },
        {
          sub: 'sde-1',
          email: 'sde@dor.gov.np',
          roleId: 'role-sde',
          role: 'SENIOR_ENGINEER',
          permissions: ['submission:forward'],
          hierarchyLevel: 60,
          departmentId: 'dept-1',
          branchId: 'branch-child',
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.fileSubmission.update).not.toHaveBeenCalled();
    expect(prisma.fileStage.create).not.toHaveBeenCalled();
  });

  it('forwards to an explicitly selected target stage and office', async () => {
    const currentSubmission = {
      id: 'submission-1',
      currentStageId: 'stage-dg',
      workflowId: 'workflow-1',
      workflowVersion: 1,
      trackingNumber: 'DOR/DOR-HQ/2082-83/VO/0020',
      title: 'VO request',
      contractorId: 'contractor-1',
      branchId: 'branch-origin',
      currentBranchId: 'branch-hq',
      metadata: { vo_percentage: 18 },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      workflow: {
        code: 'VO',
        departmentId: 'dept-1',
        stages: [
          {
            id: 'stage-dg',
            name: 'DG - Final DOR Decision',
            stageOrder: 8,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-dg',
            assignedRole: { code: 'SUPER_ADMIN', name: 'Super Administrator' },
            allowedActions: ['FORWARD', 'TOK', 'RAYE'],
            requiredDocs: [],
            slaDays: 3,
          },
          {
            id: 'stage-ddg',
            name: 'DDG - Department Review',
            stageOrder: 7,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-ddg',
            assignedRole: { code: 'DEPARTMENT_ADMIN', name: 'Department Administrator' },
            allowedActions: ['FORWARD', 'APPROVE'],
            requiredDocs: [],
            slaDays: 5,
          },
          {
            id: 'stage-se',
            name: 'SE - Review',
            stageOrder: 6,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-se',
            assignedRole: { code: 'SUPERINTENDENT_ENGINEER', name: 'Superintending Engineer' },
            allowedActions: ['FORWARD'],
            requiredDocs: [],
            slaDays: 5,
          },
        ],
      },
      documents: [],
      fileStages: [{ id: 'file-stage-dg', stageId: 'stage-dg', assignedTo: 'dg-1' }],
    };
    const detailSubmission = {
      ...currentSubmission,
      currentStageId: 'stage-ddg',
      status: SubmissionStatus.IN_REVIEW,
      fileStages: [],
      comments: [],
      signatures: [],
      documents: [],
      branch: {},
      currentBranch: {},
      contractor: {},
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce(currentSubmission)
          .mockResolvedValueOnce(detailSubmission),
        update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'submission-1' }),
      },
      fileStage: {
        updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
        create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'file-stage-ddg' }),
      },
      branch: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ departmentId: 'dept-1' }),
        findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([
          {
            id: 'branch-ddg',
            name: 'DDG Bridge Office',
            code: 'DOR-BRD',
            branchLevel: 3,
            clusterType: 'HQ_MAHASAKHA',
          },
        ]),
      },
      user: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'ddg-1',
          status: 'ACTIVE',
          departmentId: 'dept-1',
          branchId: 'branch-ddg',
          roleId: 'role-ddg',
          role: { code: 'DEPARTMENT_ADMIN' },
        }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new SubmissionsService(prisma as any, audit as any, {} as any);

    await service.forward(
      'submission-1',
      {
        targetStageId: 'stage-ddg',
        targetBranchId: 'branch-ddg',
        assignedTo: 'ddg-1',
        comment: 'Route to DDG Bridge for opinion',
      },
      {
        sub: 'dg-1',
        email: 'dg@dor.gov.np',
        roleId: 'role-dg',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
        hierarchyLevel: 100,
        departmentId: 'dept-1',
        branchId: 'branch-hq',
      },
      '127.0.0.1',
    );

    expect(prisma.fileStage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submissionId: 'submission-1',
        stageId: 'stage-ddg',
        branchId: 'branch-ddg',
        assignedTo: 'ddg-1',
        status: 'PENDING',
      }),
    });
    expect(prisma.fileSubmission.update).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
      data: {
        currentStageId: 'stage-ddg',
        currentBranchId: 'branch-ddg',
        status: SubmissionStatus.IN_REVIEW,
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.FILE_FORWARDED,
        metadata: expect.objectContaining({
          fromStage: 'DG - Final DOR Decision',
          toStage: 'DDG - Department Review',
          dynamicRoute: true,
        }),
      }),
    );
  });

  it('rejects an unknown explicit target stage instead of completing the file', async () => {
    const currentSubmission = {
      id: 'submission-1',
      currentStageId: 'stage-dg',
      workflowId: 'workflow-1',
      workflowVersion: 1,
      trackingNumber: 'DOR/DOR-HQ/2082-83/VO/0021',
      title: 'VO request',
      contractorId: 'contractor-1',
      branchId: 'branch-origin',
      currentBranchId: 'branch-hq',
      metadata: { vo_percentage: 18 },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      workflow: {
        code: 'VO',
        departmentId: 'dept-1',
        stages: [
          {
            id: 'stage-dg',
            name: 'DG - Final DOR Decision',
            stageOrder: 8,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-dg',
            assignedRole: { code: 'SUPER_ADMIN', name: 'Super Administrator' },
            allowedActions: ['FORWARD'],
            requiredDocs: [],
            slaDays: 3,
          },
        ],
      },
      documents: [],
      fileStages: [{ id: 'file-stage-dg', stageId: 'stage-dg', assignedTo: 'dg-1' }],
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(currentSubmission),
        update: jest.fn<() => Promise<any>>(),
      },
      fileStage: {
        updateMany: jest.fn<() => Promise<any>>(),
        create: jest.fn<() => Promise<any>>(),
      },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    await expect(
      service.forward(
        'submission-1',
        { targetStageId: 'stage-missing', comment: 'Route dynamically' },
        {
          sub: 'dg-1',
          email: 'dg@dor.gov.np',
          roleId: 'role-dg',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
          hierarchyLevel: 100,
          departmentId: 'dept-1',
          branchId: 'branch-hq',
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow('Target stage not found');

    expect(prisma.fileSubmission.update).not.toHaveBeenCalled();
    expect(prisma.fileStage.updateMany).not.toHaveBeenCalled();
    expect(prisma.fileStage.create).not.toHaveBeenCalled();
  });

  it('lists submissions from descendant branches for ancestor office staff', async () => {
    const prisma = {
      branch: {
        findMany: jest
          .fn<() => Promise<any[]>>()
          .mockResolvedValueOnce([{ id: 'branch-child' }])
          .mockResolvedValueOnce([]),
      },
      fileSubmission: {
        findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
      },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    await service.findAll(
      {
        sub: 'se-1',
        email: 'se@dor.gov.np',
        roleId: 'role-se',
        role: 'SUPERINTENDENT_ENGINEER',
        permissions: ['submission:view_assigned'],
        hierarchyLevel: 65,
        departmentId: 'dept-1',
        branchId: 'branch-parent',
      },
      {},
    );

    expect(prisma.fileSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workflow: { departmentId: 'dept-1' },
          currentBranchId: { in: ['branch-parent', 'branch-child'] },
        }),
      }),
    );
  });

  it('blocks direct SDE approval when a DOR VO exceeds the SDE threshold', async () => {
    const currentSubmission = {
      id: 'submission-1',
      currentStageId: 'stage-sde',
      workflowId: 'workflow-1',
      workflowVersion: 1,
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0010',
      title: 'VO request',
      contractorId: 'contractor-1',
      branchId: 'branch-1',
      metadata: { vo_percentage: 12 },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      workflow: {
        code: 'VO',
        departmentId: 'dept-1',
        stages: [
          {
            id: 'stage-sde',
            name: 'SDE - Review and Decision',
            stageOrder: 4,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-sde',
            assignedRole: { code: 'SENIOR_ENGINEER', name: 'Senior Engineer' },
            allowedActions: ['APPROVE', 'FORWARD'],
            requiredDocs: [],
            slaDays: 3,
          },
        ],
      },
      documents: [],
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(currentSubmission),
        update: jest.fn<() => Promise<any>>(),
      },
      fileStage: {
        updateMany: jest.fn<() => Promise<any>>(),
      },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);

    await expect(
      service.approve(
        'submission-1',
        { comment: 'Approve at SDE' },
        {
          sub: 'sde-1',
          email: 'sde@dor.gov.np',
          roleId: 'role-sde',
          role: 'SENIOR_ENGINEER',
          permissions: ['submission:approve'],
          hierarchyLevel: 60,
          departmentId: 'dept-1',
          branchId: 'branch-1',
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.fileSubmission.update).not.toHaveBeenCalled();
  });

  it('marks a DG-stage submission as forwarded to ministry', async () => {
    const currentSubmission = {
      id: 'submission-1',
      currentStageId: 'stage-dg',
      workflowId: 'workflow-1',
      workflowVersion: 1,
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0009',
      title: 'VO request',
      contractorId: 'contractor-1',
      branchId: 'branch-1',
      metadata: { vo_percentage: 20 },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      workflow: {
        code: 'VO',
        departmentId: 'dept-1',
        stages: [
          {
            id: 'stage-dg',
            name: 'DG - Final DOR Decision',
            stageOrder: 7,
            stageType: 'SEQUENTIAL',
            assignedRoleId: 'role-dg',
            assignedRole: { code: 'SUPER_ADMIN', name: 'Super Administrator' },
            allowedActions: ['FORWARD_TO_MINISTRY'],
            requiredDocs: [],
            slaDays: 3,
          },
        ],
      },
      documents: [],
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce(currentSubmission)
          .mockResolvedValueOnce({
            ...currentSubmission,
            currentStageId: null,
            status: SubmissionStatus.FORWARDED_TO_MINISTRY,
            fileStages: [],
            comments: [],
            signatures: [],
            documents: [],
            branch: {},
            contractor: {},
          }),
        update: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'submission-1' }),
      },
      fileStage: {
        updateMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
      },
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new SubmissionsService(prisma as any, audit as any, {} as any);

    await service.forwardToMinistry(
      'submission-1',
      { ministryReference: 'MID-VO-9', comment: 'Escalated to ministry' },
      {
        sub: 'dg-1',
        email: 'dg@dor.gov.np',
        roleId: 'role-dg',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
        hierarchyLevel: 100,
        departmentId: 'dept-1',
        branchId: 'branch-1',
      },
      '127.0.0.1',
    );

    expect(prisma.fileSubmission.update).toHaveBeenCalledWith({
      where: { id: 'submission-1' },
      data: {
        currentStageId: null,
        status: SubmissionStatus.FORWARDED_TO_MINISTRY,
      },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.FORWARDED_TO_MINISTRY,
      }),
    );
  });
});
