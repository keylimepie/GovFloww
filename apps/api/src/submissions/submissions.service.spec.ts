import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as crypto from 'crypto';
import { AuditAction } from '@govflow/shared';
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
});
