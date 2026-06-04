import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { AuditAction, SakhaType, StageAction } from '@govflow/shared';
import { DorService } from './dor.service';

const officer = {
  sub: 'engineer-1',
  email: 'engineer@dor.gov.np',
  role: 'ENGINEER',
  roleId: 'role-engineer',
  permissions: ['submission:tok_assign', 'submission:tippani_prepare'],
  hierarchyLevel: 50,
  departmentId: 'dept-dor',
  branchId: 'branch-parent',
};

function activeSubmissionContext(stageOverrides: Record<string, unknown> = {}) {
  const stage = {
    id: 'stage-1',
    name: 'Engineer - Tippani',
    assignedRoleId: 'role-engineer',
    assignedRole: { code: 'ENGINEER', name: 'Engineer' },
    allowedActions: [StageAction.TOK, StageAction.TIPPANI],
    requiredDocs: ['TIPPANI'],
    ...stageOverrides,
  };

  return {
    id: 'submission-1',
    contractorId: 'contractor-1',
    branchId: 'branch-child',
    currentStageId: 'stage-1',
    trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
    title: 'Variation order file',
    workflow: {
      name: 'DOR Variation Order Approval',
      departmentId: 'dept-dor',
      department: { id: 'dept-dor', code: 'DOR' },
      stages: [stage],
    },
    branch: { id: 'branch-child', parentBranchId: 'branch-parent' },
    fileStages: [
      {
        id: 'file-stage-1',
        stageId: 'stage-1',
        stage,
      },
    ],
  };
}

describe('DorService', () => {
  it('creates a Tok assignment for an officer in the same office branch', async () => {
    const tx = {
      tokAssignment: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'tok-1',
          submissionId: 'submission-1',
          tokTo: 'subengineer-1',
        }),
      },
      notification: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'notification-1' }),
      },
    };

    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(activeSubmissionContext()),
      },
      branch: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce({ id: 'branch-child', parentBranchId: 'branch-parent' })
          .mockResolvedValueOnce({ id: 'branch-parent', parentBranchId: null })
          .mockResolvedValueOnce({ departmentId: 'dept-dor' }),
      },
      user: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'subengineer-1',
          status: 'ACTIVE',
          departmentId: 'dept-dor',
          branchId: 'branch-parent',
          role: { code: 'SUB_ENGINEER', hierarchyLevel: 40 },
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new DorService(prisma as any, audit as any, {} as any);

    await expect(
      service.createTok(
        'submission-1',
        { tokTo: 'subengineer-1', taskDescription: 'Check measurement entries', continueFile: false },
        officer,
        '127.0.0.1',
      ),
    ).resolves.toMatchObject({ id: 'tok-1' });

    expect(tx.tokAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileStageId: 'file-stage-1',
          submissionId: 'submission-1',
          tokBy: 'engineer-1',
          tokTo: 'subengineer-1',
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.TOK_ASSIGNED,
        actorId: 'engineer-1',
        submissionId: 'submission-1',
      }),
    );
  });

  it('lists Tok assignments for an authorized submission viewer', async () => {
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(activeSubmissionContext()),
      },
      branch: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce({ id: 'branch-child', parentBranchId: 'branch-parent' })
          .mockResolvedValueOnce({ id: 'branch-parent', parentBranchId: null }),
      },
      tokAssignment: {
        findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([{ id: 'tok-1' }]),
      },
    };
    const service = new DorService(prisma as any, {} as any, {} as any);

    await expect(service.listTokForSubmission('submission-1', officer)).resolves.toEqual([{ id: 'tok-1' }]);
    expect(prisma.tokAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { submissionId: 'submission-1' },
        orderBy: { assignedAt: 'desc' },
      }),
    );
  });

  it('scopes pending Raye duplicate checks by Sakha, target office, and officer', async () => {
    const tx = {
      rayeRequest: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'raye-1',
          submissionId: 'submission-1',
          targetSakha: SakhaType.PRABIDHIK,
          targetBranchId: 'branch-ddg-bridge',
          assignedTo: 'ddg-bridge-1',
        }),
      },
      notification: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'notification-1' }),
      },
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(activeSubmissionContext()),
      },
      branch: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ departmentId: 'dept-dor' }),
      },
      user: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({
          departmentId: 'dept-dor',
          branchId: 'branch-ddg-bridge',
          status: 'ACTIVE',
        }),
      },
      rayeRequest: {
        findFirst: jest.fn<() => Promise<any>>().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const service = new DorService(prisma as any, audit as any, {} as any);

    await expect(
      service.createRaye(
        'submission-1',
        {
          targetSakha: SakhaType.PRABIDHIK,
          targetBranchId: 'branch-ddg-bridge',
          assignedTo: 'ddg-bridge-1',
          requestText: 'Please provide DDG Bridge opinion.',
          canReassign: true,
        },
        {
          sub: 'dg-1',
          email: 'dg@dor.gov.np',
          role: 'SUPER_ADMIN',
          roleId: 'role-dg',
          permissions: ['*'],
          hierarchyLevel: 100,
          departmentId: 'dept-dor',
          branchId: 'branch-hq',
        },
        '127.0.0.1',
      ),
    ).resolves.toMatchObject({ id: 'raye-1' });

    expect(prisma.rayeRequest.findFirst).toHaveBeenCalledWith({
      where: {
        fileStageId: 'file-stage-1',
        targetSakha: SakhaType.PRABIDHIK,
        status: 'PENDING',
        targetBranchId: 'branch-ddg-bridge',
        assignedTo: 'ddg-bridge-1',
      },
    });
    expect(tx.rayeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          targetBranchId: 'branch-ddg-bridge',
          assignedTo: 'ddg-bridge-1',
        }),
      }),
    );
  });

  it('generates and links a Tippani PDF document', async () => {
    const generatedDocument = {
      id: 'doc-tippani-1',
      originalName: 'tippani-DOR-RD-KTM-2082-83-VO-0001.pdf',
      sha256: 'abc123',
    };
    const tx = {
      document: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue(generatedDocument),
      },
      tippaniMetadata: {
        create: jest.fn<() => Promise<any>>().mockResolvedValue({
          id: 'tippani-1',
          submissionId: 'submission-1',
          fileStageId: 'file-stage-1',
          documentId: generatedDocument.id,
          preparedBy: 'engineer-1',
          subject: 'Variation order recommendation',
          recommendation: 'Approve after BOQ correction.',
          referenceDocuments: ['doc-reference-1'],
          document: generatedDocument,
        }),
      },
    };
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(activeSubmissionContext()),
      },
      branch: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce({ id: 'branch-child', parentBranchId: 'branch-parent' })
          .mockResolvedValueOnce({ id: 'branch-parent', parentBranchId: null }),
      },
      document: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ submissionId: 'submission-1' }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = { log: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    const storage = {
      uploadGeneratedFile: jest.fn<() => Promise<any>>().mockResolvedValue({
        storageKey: 'submissions/DOR/tippani/file.pdf',
        sha256: 'abc123',
      }),
    };
    const service = new DorService(prisma as any, audit as any, storage as any);

    await expect(
      service.prepareTippani(
        'submission-1',
        {
          subject: 'Variation order recommendation',
          recommendation: 'Approve after BOQ correction.',
          referenceDocuments: [],
          documentId: 'doc-reference-1',
        },
        officer,
        '127.0.0.1',
      ),
    ).resolves.toMatchObject({ id: 'tippani-1', documentId: 'doc-tippani-1' });

    expect(storage.uploadGeneratedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'application/pdf',
        fileName: expect.stringMatching(/^tippani-/),
      }),
    );
    expect(tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        submissionId: 'submission-1',
        originalName: expect.stringMatching(/\.pdf$/),
        mimeType: 'application/pdf',
        uploaderId: 'engineer-1',
        stageId: 'stage-1',
      }),
    });
    expect(tx.tippaniMetadata.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: 'doc-tippani-1',
          referenceDocuments: ['doc-reference-1'],
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.TIPPANI_PREPARED,
        metadata: expect.objectContaining({ documentId: 'doc-tippani-1' }),
      }),
    );
  });

  it('blocks Tippani preparation when the current stage does not configure Tippani', async () => {
    const prisma = {
      fileSubmission: {
        findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(
          activeSubmissionContext({
            allowedActions: [StageAction.FORWARD],
            requiredDocs: [],
          }),
        ),
      },
      branch: {
        findUnique: jest
          .fn<() => Promise<any>>()
          .mockResolvedValueOnce({ id: 'branch-child', parentBranchId: 'branch-parent' })
          .mockResolvedValueOnce({ id: 'branch-parent', parentBranchId: null }),
      },
    };
    const service = new DorService(prisma as any, {} as any, {} as any);

    await expect(
      service.prepareTippani(
        'submission-1',
        {
          subject: 'Variation order recommendation',
          recommendation: 'Approve after BOQ correction.',
          referenceDocuments: [],
        },
        officer,
        '127.0.0.1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
