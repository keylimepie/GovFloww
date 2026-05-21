import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FileStageStatus, JwtPayload, SubmissionStatus } from '@govflow/shared';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationalSummary(user: JwtPayload) {
    const where = this.buildSubmissionScope(user);
    const now = new Date();

    const [submissions, activeStages, breachedStages] = await Promise.all([
      this.prisma.fileSubmission.findMany({
        where,
        select: {
          id: true,
          trackingNumber: true,
          title: true,
          status: true,
          publicTrackable: true,
          createdAt: true,
          updatedAt: true,
          branch: { select: { id: true, name: true } },
          workflow: { select: { id: true, name: true, departmentId: true } },
        },
      }),
      this.prisma.fileStage.findMany({
        where: {
          status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] },
          submission: where,
        },
        select: {
          id: true,
          slaDueAt: true,
          assignedOfficer: { select: { id: true, firstName: true, lastName: true } },
          stage: { select: { name: true, assignedRole: { select: { name: true, code: true } } } },
          submission: {
            select: {
              id: true,
              trackingNumber: true,
              title: true,
              branch: { select: { name: true } },
              workflow: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.fileStage.findMany({
        where: {
          status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] },
          slaDueAt: { lt: now },
          submission: where,
        },
        select: {
          id: true,
          slaDueAt: true,
          stage: { select: { name: true } },
          submission: {
            select: {
              id: true,
              trackingNumber: true,
              title: true,
              branch: { select: { name: true } },
              workflow: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return {
      totals: this.calculateTotals(submissions, breachedStages.length),
      byStatus: this.countBy(submissions, (submission) => submission.status),
      byWorkflow: this.countBy(submissions, (submission) => submission.workflow.name),
      byBranch: this.countBy(submissions, (submission) => submission.branch.name),
      workload: this.buildWorkload(activeStages, now),
      slaBreaches: breachedStages.map((stage) => ({
        fileStageId: stage.id,
        trackingNumber: stage.submission.trackingNumber,
        title: stage.submission.title,
        workflowName: stage.submission.workflow.name,
        branchName: stage.submission.branch.name,
        stageName: stage.stage.name,
        slaDueAt: stage.slaDueAt,
        daysOverdue: this.daysBetween(stage.slaDueAt, now),
      })),
      generatedAt: now,
    };
  }

  toOperationalSummaryCsv(report: Awaited<ReturnType<ReportsService['getOperationalSummary']>>) {
    const rows: string[][] = [
      ['Section', 'Metric', 'Value'],
      ['Totals', 'Total files', String(report.totals.total)],
      ['Totals', 'Active files', String(report.totals.active)],
      ['Totals', 'Approved files', String(report.totals.approved)],
      ['Totals', 'Rejected files', String(report.totals.rejected)],
      ['Totals', 'On hold files', String(report.totals.onHold)],
      ['Totals', 'Archived files', String(report.totals.archived)],
      ['Totals', 'Public trackable files', String(report.totals.publicTrackable)],
      ['Totals', 'Breached stages', String(report.totals.breachedStages)],
      [],
      ['Status Breakdown', 'Status', 'Count'],
      ...report.byStatus.map((item) => ['Status Breakdown', item.label, String(item.count)]),
      [],
      ['Workflow Breakdown', 'Workflow', 'Count'],
      ...report.byWorkflow.map((item) => ['Workflow Breakdown', item.label, String(item.count)]),
      [],
      ['Branch Breakdown', 'Branch', 'Count'],
      ...report.byBranch.map((item) => ['Branch Breakdown', item.label, String(item.count)]),
      [],
      ['Workload', 'Desk', 'Role', 'Pending', 'Overdue'],
      ...report.workload.map((item) => [
        'Workload',
        item.label,
        item.role,
        String(item.pending),
        String(item.overdue),
      ]),
      [],
      ['SLA Breaches', 'Tracking', 'Title', 'Workflow', 'Branch', 'Stage', 'Due At', 'Days Overdue'],
      ...report.slaBreaches.map((item) => [
        'SLA Breaches',
        item.trackingNumber,
        item.title,
        item.workflowName,
        item.branchName,
        item.stageName,
        item.slaDueAt.toISOString(),
        String(item.daysOverdue),
      ]),
    ];

    return rows.map((row) => row.map((cell) => this.escapeCsv(cell)).join(',')).join('\n');
  }

  private buildSubmissionScope(user: JwtPayload) {
    const where: Record<string, unknown> = {};

    if (user.role === 'CONTRACTOR') {
      where.contractorId = user.sub;
      return where;
    }

    if (user.role !== 'SUPER_ADMIN') {
      if (user.departmentId) {
        where.workflow = { departmentId: user.departmentId };
      }
      if (user.branchId) {
        where.branchId = user.branchId;
      }
    }

    return where;
  }

  private calculateTotals(
    submissions: Array<{ status: string; publicTrackable: boolean }>,
    breachedStages: number,
  ) {
    return {
      total: submissions.length,
      active: submissions.filter((item) =>
        [SubmissionStatus.SUBMITTED, SubmissionStatus.IN_REVIEW, SubmissionStatus.QUERY_RAISED].includes(item.status as SubmissionStatus),
      ).length,
      approved: submissions.filter((item) => item.status === SubmissionStatus.APPROVED).length,
      rejected: submissions.filter((item) => item.status === SubmissionStatus.REJECTED).length,
      onHold: submissions.filter((item) => item.status === SubmissionStatus.ON_HOLD).length,
      archived: submissions.filter((item) => item.status === SubmissionStatus.ARCHIVED).length,
      publicTrackable: submissions.filter((item) => item.publicTrackable).length,
      breachedStages,
    };
  }

  private buildWorkload(
    stages: Array<{
      id: string;
      slaDueAt: Date;
      assignedOfficer: { id: string; firstName: string; lastName: string } | null;
      stage: { name: string; assignedRole: { name: string; code: string } };
      submission: { id: string; trackingNumber: string; title: string; branch: { name: string }; workflow: { name: string } };
    }>,
    now: Date,
  ) {
    const grouped = new Map<string, {
      key: string;
      label: string;
      role: string;
      pending: number;
      overdue: number;
      items: Array<Record<string, unknown>>;
    }>();

    for (const stage of stages) {
      const key = stage.assignedOfficer?.id || stage.stage.assignedRole.code;
      const label = stage.assignedOfficer
        ? `${stage.assignedOfficer.firstName} ${stage.assignedOfficer.lastName}`
        : stage.stage.assignedRole.name;
      const entry = grouped.get(key) || {
        key,
        label,
        role: stage.stage.assignedRole.name,
        pending: 0,
        overdue: 0,
        items: [],
      };

      const overdue = stage.slaDueAt < now;
      entry.pending++;
      if (overdue) entry.overdue++;
      entry.items.push({
        fileStageId: stage.id,
        trackingNumber: stage.submission.trackingNumber,
        title: stage.submission.title,
        workflowName: stage.submission.workflow.name,
        branchName: stage.submission.branch.name,
        stageName: stage.stage.name,
        slaDueAt: stage.slaDueAt,
        overdue,
      });
      grouped.set(key, entry);
    }

    return Array.from(grouped.values()).sort((a, b) => b.pending - a.pending);
  }

  private countBy<T>(items: T[], getKey: (item: T) => string) {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = getKey(item) || 'Unspecified';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  private daysBetween(from: Date, to: Date) {
    return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
  }

  private escapeCsv(value: string) {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  }
}
