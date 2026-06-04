import { describe, expect, it, jest } from '@jest/globals';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  function createPrisma() {
    const now = new Date();
    return {
      fileSubmission: {
        findMany: jest.fn<() => Promise<any>>().mockResolvedValue([
          {
            id: 'sub-1',
            trackingNumber: '2026-PWD-0001',
            title: 'Bridge BOQ',
            status: 'IN_REVIEW',
            publicTrackable: true,
            createdAt: now,
            updatedAt: now,
            branch: { id: 'branch-1', name: 'Head Office' },
            workflow: { id: 'workflow-1', name: 'BOQ Approval', departmentId: 'dept-1' },
          },
          {
            id: 'sub-2',
            trackingNumber: '2026-PWD-0002',
            title: 'Road BOQ',
            status: 'APPROVED',
            publicTrackable: false,
            createdAt: now,
            updatedAt: now,
            branch: { id: 'branch-1', name: 'Head Office' },
            workflow: { id: 'workflow-1', name: 'BOQ Approval', departmentId: 'dept-1' },
          },
        ]),
      },
      fileStage: {
        findMany: jest.fn<() => Promise<any>>()
          .mockResolvedValueOnce([
            {
              id: 'stage-1',
              slaDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
              assignedOfficer: null,
              stage: { name: 'Engineer Review', assignedRole: { name: 'Engineer', code: 'ENGINEER' } },
              submission: {
                id: 'sub-1',
                trackingNumber: '2026-PWD-0001',
                title: 'Bridge BOQ',
                branch: { name: 'Head Office' },
                workflow: { name: 'BOQ Approval' },
              },
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'stage-1',
              slaDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
              stage: { name: 'Engineer Review' },
              submission: {
                id: 'sub-1',
                trackingNumber: '2026-PWD-0001',
                title: 'Bridge BOQ',
                branch: { name: 'Head Office' },
                workflow: { name: 'BOQ Approval' },
              },
            },
          ]),
      },
    };
  }

  it('returns operational summary scoped to department admins', async () => {
    const prisma = createPrisma();
    const service = new ReportsService(prisma as any);

    const report = await service.getOperationalSummary({
      sub: 'admin-1',
      email: 'admin@govflow.gov.np',
      roleId: 'role-1',
      role: 'DEPARTMENT_ADMIN',
      permissions: ['report:dept'],
      hierarchyLevel: 80,
      departmentId: 'dept-1',
      branchId: null,
    });

    expect(prisma.fileSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workflow: { departmentId: 'dept-1' } } }),
    );
    expect(report.totals).toMatchObject({
      total: 2,
      active: 1,
      approved: 1,
      publicTrackable: 1,
      breachedStages: 1,
    });
    expect(report.workload[0]).toMatchObject({
      label: 'Engineer',
      pending: 1,
      overdue: 1,
    });
  });

  it('exports operational summary as CSV', async () => {
    const service = new ReportsService({} as any);
    const csv = service.toOperationalSummaryCsv({
      totals: {
        total: 1,
        active: 1,
        approved: 0,
        rejected: 0,
        onHold: 0,
        archived: 0,
        publicTrackable: 1,
        breachedStages: 1,
      },
      byStatus: [{ label: 'IN_REVIEW', count: 1 }],
      byWorkflow: [{ label: 'BOQ, Approval', count: 1 }],
      byBranch: [{ label: 'Head Office', count: 1 }],
      workload: [{ key: 'ENGINEER', label: 'Engineer', role: 'Engineer', pending: 1, overdue: 1, items: [] }],
      slaBreaches: [{
        fileStageId: 'stage-1',
        trackingNumber: '2026-PWD-0001',
        title: 'Bridge BOQ',
        workflowName: 'BOQ Approval',
        branchName: 'Head Office',
        stageName: 'Engineer Review',
        slaDueAt: new Date('2026-05-20T00:00:00.000Z'),
        daysOverdue: 2,
      }],
      generatedAt: new Date('2026-05-20T00:00:00.000Z'),
    });

    expect(csv).toContain('Totals,Total files,1');
    expect(csv).toContain('"BOQ, Approval"');
    expect(csv).toContain('SLA Breaches,2026-PWD-0001,Bridge BOQ');
  });

  it('returns file flow and pending aging reports with scoped records', async () => {
    const startedAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const prisma = {
      fileSubmission: {
        findMany: jest.fn<() => Promise<any>>().mockResolvedValue([
          {
            id: 'sub-1',
            trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
            title: 'Variation Order',
            status: 'IN_REVIEW',
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            branch: { name: 'Road Division Kathmandu', code: 'RD-KTM' },
            currentBranch: { name: 'Road Division Kathmandu', code: 'RD-KTM' },
            workflow: { name: 'DOR Variation Order Approval' },
            fileStages: [
              {
                id: 'fs-1',
                status: 'PENDING',
                startedAt,
                completedAt: null,
                slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                branch: { name: 'Road Division Kathmandu', code: 'RD-KTM' },
                assignedOfficer: { id: 'user-1', firstName: 'Engineer', lastName: 'KTM', designation: 'Engineer' },
                stage: {
                  name: 'Engineer Review',
                  stageOrder: 3,
                  assignedRole: { name: 'Engineer', code: 'ENGINEER' },
                },
              },
            ],
          },
        ]),
      },
      fileStage: {
        findMany: jest.fn<() => Promise<any>>().mockResolvedValue([
          {
            id: 'fs-1',
            status: 'PENDING',
            startedAt,
            slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            assignedOfficer: { id: 'user-1', firstName: 'Engineer', lastName: 'KTM', designation: 'Engineer' },
            stage: {
              name: 'Engineer Review',
              assignedRole: { name: 'Engineer', code: 'ENGINEER' },
            },
            submission: {
              id: 'sub-1',
              trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
              title: 'Variation Order',
              workflow: { name: 'DOR Variation Order Approval' },
              branch: { name: 'Road Division Kathmandu' },
              currentBranch: { name: 'Road Division Kathmandu' },
            },
          },
        ]),
      },
    };
    const service = new ReportsService(prisma as any);
    const user = {
      sub: 'admin-1',
      email: 'admin@govflow.gov.np',
      roleId: 'role-1',
      role: 'DEPARTMENT_ADMIN',
      permissions: ['report:dept'],
      hierarchyLevel: 80,
      departmentId: 'dept-1',
      branchId: null,
    };

    const fileFlow = await service.getFileFlowReport(user as any);
    const aging = await service.getPendingAgingReport(user as any);

    expect(fileFlow.files[0]).toMatchObject({
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
      originOffice: 'Road Division Kathmandu (RD-KTM)',
    });
    expect(fileFlow.files[0].steps[0]).toMatchObject({
      stageName: 'Engineer Review',
      officer: 'Engineer KTM - Engineer',
    });
    expect(aging.items[0]).toMatchObject({
      trackingNumber: 'DOR/RD-KTM/2082-83/VO/0001',
      bucket: '3-5 days',
    });
  });
});
