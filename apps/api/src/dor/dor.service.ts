import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  FileStageStatus,
  NotificationType,
  RayeStatus,
  StageAction,
  SubmissionStatus,
  TokStatus,
} from '@govflow/shared';
import type {
  CompleteTokAssignmentInput,
  CreateRayeRequestInput,
  CreateTokAssignmentInput,
  JwtPayload,
  PrepareTippaniInput,
  RespondRayeRequestInput,
} from '@govflow/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ACTIVE_STAGE_STATUSES = ['PENDING', 'IN_PROGRESS'];
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'BRANCH_ADMIN']);

@Injectable()
export class DorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async getBranchHierarchy(user: JwtPayload) {
    const where =
      user.role === 'SUPER_ADMIN' || !user.departmentId
        ? {}
        : { departmentId: user.departmentId };

    return this.prisma.branch.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        departmentId: true,
        branchLevel: true,
        parentBranchId: true,
        clusterType: true,
        nepaliName: true,
        isDorHq: true,
      },
      orderBy: [{ branchLevel: 'desc' }, { name: 'asc' }],
    });
  }

  async listActionUsers(user: JwtPayload) {
    const where: any = {
      status: 'ACTIVE',
      role: { code: { notIn: ['CONTRACTOR', 'CITIZEN', 'IT_ADMIN'] } },
    };

    if (user.role !== 'SUPER_ADMIN' && user.departmentId) {
      where.departmentId = user.departmentId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        designation: true,
        role: { select: { id: true, name: true, code: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async createTok(
    submissionId: string,
    dto: CreateTokAssignmentInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const context = await this.getActiveSubmissionContext(submissionId);
    await this.ensureCanActOnCurrentStage(
      context,
      user,
      'submission:tok_assign',
      StageAction.TOK,
    );

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.tokTo },
      select: {
        id: true,
        status: true,
        departmentId: true,
        branchId: true,
        role: { select: { code: true, hierarchyLevel: true } },
      },
    });
    if (!targetUser) throw new NotFoundException('Tok target user not found');
    if (targetUser.status !== 'ACTIVE') {
      throw new BadRequestException('Tok target user must be active');
    }
    if (
      context.submission.workflow.departmentId &&
      targetUser.departmentId !== context.submission.workflow.departmentId
    ) {
      throw new ForbiddenException('Tok target must belong to the same department');
    }
    if (user.role !== 'SUPER_ADMIN' && targetUser.role.hierarchyLevel >= user.hierarchyLevel) {
      throw new ForbiddenException('Tok can only be assigned to a subordinate role');
    }

    const actorOfficeBranchId = this.resolveActorOfficeBranchId(context, user);
    const targetBranchId = dto.targetBranchId || actorOfficeBranchId;
    if (targetBranchId) {
      await this.ensureBranchInDepartment(targetBranchId, context.submission.workflow.departmentId);
    }
    if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
      if (!actorOfficeBranchId) {
        throw new ForbiddenException('Tok requires an active office branch');
      }
      if (targetBranchId !== actorOfficeBranchId) {
        throw new ForbiddenException('Tok can only be assigned within your own office branch');
      }
    }
    if (targetBranchId && targetUser.branchId !== targetBranchId) {
      throw new ForbiddenException('Tok target must belong to the selected office branch');
    }

    const continuationStage = dto.continueFile
      ? this.resolveTokContinuationStage(context.submission.workflow.stages, targetUser, dto.targetStageId)
      : null;

    const tok = await this.prisma.$transaction(async (tx) => {
      let tokFileStageId = context.activeFileStage.id;

      if (continuationStage) {
        await tx.fileStage.updateMany({
          where: {
            submissionId,
            stageId: context.currentStage.id,
            status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] },
          },
          data: {
            status: FileStageStatus.COMPLETED,
            completedAt: new Date(),
            assignedTo: user.sub,
          },
        });

        const continuedFileStage = await tx.fileStage.create({
          data: {
            submissionId,
            stageId: continuationStage.id,
            branchId: targetBranchId || targetUser.branchId || context.submission.currentBranchId || context.submission.branchId,
            assignedTo: dto.tokTo,
            status: FileStageStatus.PENDING,
            slaDueAt: this.calculateSlaDueDate(continuationStage.slaDays),
          },
        });
        tokFileStageId = continuedFileStage.id;

        await tx.fileSubmission.update({
          where: { id: submissionId },
          data: {
            currentStageId: continuationStage.id,
            currentBranchId: targetBranchId || targetUser.branchId || context.submission.currentBranchId || context.submission.branchId,
            status: SubmissionStatus.IN_REVIEW,
          },
        });
      }

      const created = await tx.tokAssignment.create({
        data: {
          fileStageId: tokFileStageId,
          submissionId,
          tokBy: user.sub,
          tokTo: dto.tokTo,
          taskDescription: dto.taskDescription || null,
        },
        include: this.tokInclude(),
      });

      await tx.notification.create({
        data: {
          recipientId: dto.tokTo,
          type: NotificationType.TOK_RECEIVED,
          title: 'Tok assignment received',
          message: `You have received a Tok assignment for ${context.submission.trackingNumber}.`,
          payload: {
            submissionId,
            tokAssignmentId: created.id,
            trackingNumber: context.submission.trackingNumber,
          },
        },
      });

      return created;
    });

    await this.audit.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.TOK_ASSIGNED,
      metadata: {
        tokAssignmentId: tok.id,
        tokTo: dto.tokTo,
        targetBranchId: targetBranchId || null,
        fileStageId: tok.fileStageId,
        continueFile: Boolean(dto.continueFile),
        targetStageId: continuationStage?.id || null,
      },
      ipAddress,
    });

    return tok;
  }

  async completeTok(
    tokId: string,
    dto: CompleteTokAssignmentInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const tok = await this.prisma.tokAssignment.findUnique({
      where: { id: tokId },
      include: this.tokInclude(),
    });
    if (!tok) throw new NotFoundException('Tok assignment not found');
    if (tok.status !== TokStatus.ACTIVE) {
      throw new BadRequestException('Tok assignment is not active');
    }
    if (user.role !== 'SUPER_ADMIN' && tok.tokTo !== user.sub) {
      throw new ForbiddenException('Only the Tok recipient can complete this assignment');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const completed = await tx.tokAssignment.update({
        where: { id: tokId },
        data: {
          status: TokStatus.COMPLETED,
          responseNote: dto.responseNote,
          completedAt: new Date(),
        },
        include: this.tokInclude(),
      });

      await tx.notification.create({
        data: {
          recipientId: tok.tokBy,
          type: NotificationType.TOK_COMPLETED,
          title: 'Tok assignment completed',
          message: `A Tok assignment for ${tok.submission.trackingNumber} has been completed.`,
          payload: {
            submissionId: tok.submissionId,
            tokAssignmentId: tokId,
            trackingNumber: tok.submission.trackingNumber,
          },
        },
      });

      return completed;
    });

    await this.audit.log({
      submissionId: tok.submissionId,
      actorId: user.sub,
      action: AuditAction.TOK_COMPLETED,
      metadata: { tokAssignmentId: tokId, responseNote: dto.responseNote },
      ipAddress,
    });

    return updated;
  }

  async recallTok(tokId: string, user: JwtPayload, ipAddress: string) {
    const tok = await this.prisma.tokAssignment.findUnique({
      where: { id: tokId },
      include: this.tokInclude(),
    });
    if (!tok) throw new NotFoundException('Tok assignment not found');
    if (tok.status !== TokStatus.ACTIVE) {
      throw new BadRequestException('Only active Tok assignments can be recalled');
    }
    if (user.role !== 'SUPER_ADMIN' && tok.tokBy !== user.sub) {
      throw new ForbiddenException('Only the assigning officer can recall this Tok');
    }

    const updated = await this.prisma.tokAssignment.update({
      where: { id: tokId },
      data: { status: TokStatus.RECALLED },
      include: this.tokInclude(),
    });

    await this.audit.log({
      submissionId: tok.submissionId,
      actorId: user.sub,
      action: AuditAction.TOK_RECALLED,
      metadata: { tokAssignmentId: tokId },
      ipAddress,
    });

    return updated;
  }

  async myTokInbox(user: JwtPayload) {
    return this.prisma.tokAssignment.findMany({
      where: { tokTo: user.sub, status: TokStatus.ACTIVE },
      include: this.tokInclude(),
      orderBy: { assignedAt: 'desc' },
    });
  }

  async listTokForSubmission(submissionId: string, user: JwtPayload) {
    await this.getScopedSubmission(submissionId, user);

    return this.prisma.tokAssignment.findMany({
      where: { submissionId },
      include: this.tokInclude(),
      orderBy: { assignedAt: 'desc' },
    });
  }

  async createRaye(
    submissionId: string,
    dto: CreateRayeRequestInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const context = await this.getActiveSubmissionContext(submissionId);
    await this.ensureCanActOnCurrentStage(
      context,
      user,
      'submission:raye_request',
      StageAction.RAYE,
    );

    const actorOfficeBranchId = this.resolveActorOfficeBranchId(context, user);
    const targetBranchId = dto.targetBranchId || actorOfficeBranchId;
    if (targetBranchId) {
      await this.ensureBranchInDepartment(targetBranchId, context.submission.workflow.departmentId);
    }
    if (!['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(user.role)) {
      if (!actorOfficeBranchId) {
        throw new ForbiddenException('Raye requires an active office branch');
      }
      if (targetBranchId !== actorOfficeBranchId) {
        throw new ForbiddenException('Raye can only be requested within your own office branch');
      }
    }
    let assignedRayeUser: { branchId: string | null } | null = null;
    if (dto.assignedTo) {
      assignedRayeUser = await this.ensureUserInDepartment(dto.assignedTo, context.submission.workflow.departmentId);
    }
    if (targetBranchId && assignedRayeUser) {
      if (assignedRayeUser.branchId !== targetBranchId) {
        throw new ForbiddenException('Assigned Raye officer must belong to the selected office branch');
      }
    }

    const duplicate = await this.prisma.rayeRequest.findFirst({
      where: {
        fileStageId: context.activeFileStage.id,
        targetSakha: dto.targetSakha,
        status: RayeStatus.PENDING,
        targetBranchId: targetBranchId || null,
        assignedTo: dto.assignedTo || null,
      },
    });
    if (duplicate) {
      throw new BadRequestException('A pending Raye already exists for this Sakha at the current stage');
    }

    const raye = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rayeRequest.create({
        data: {
          fileStageId: context.activeFileStage.id,
          submissionId,
          requestedBy: user.sub,
          targetSakha: dto.targetSakha,
          targetBranchId: targetBranchId || null,
          assignedTo: dto.assignedTo || null,
          requestText: dto.requestText,
          canReassign: dto.canReassign,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        },
        include: this.rayeInclude(),
      });

      if (dto.assignedTo) {
        await tx.notification.create({
          data: {
            recipientId: dto.assignedTo,
            type: NotificationType.RAYE_REQUEST_RECEIVED,
            title: 'Raye request received',
            message: `A Raye request was sent for ${context.submission.trackingNumber}.`,
            payload: {
              submissionId,
              rayeRequestId: created.id,
              trackingNumber: context.submission.trackingNumber,
              targetSakha: dto.targetSakha,
            },
          },
        });
      }

      return created;
    });

    await this.audit.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.RAYE_REQUESTED,
      metadata: {
        rayeRequestId: raye.id,
        targetSakha: dto.targetSakha,
        targetBranchId: targetBranchId || null,
        assignedTo: dto.assignedTo || null,
      },
      ipAddress,
    });

    return raye;
  }

  async respondRaye(
    rayeId: string,
    dto: RespondRayeRequestInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const raye = await this.prisma.rayeRequest.findUnique({
      where: { id: rayeId },
      include: this.rayeInclude(),
    });
    if (!raye) throw new NotFoundException('Raye request not found');
    if (raye.status !== RayeStatus.PENDING) {
      throw new BadRequestException('Raye request is not pending');
    }

    const hasRespondPermission = this.hasPermission(user, 'submission:raye_respond');
    const assignedToUser = raye.assignedTo === user.sub;
    if (user.role !== 'SUPER_ADMIN' && !assignedToUser && !hasRespondPermission) {
      throw new ForbiddenException('You cannot respond to this Raye request');
    }
    await this.ensureSubmissionScope(raye.submission, user);

    const updated = await this.prisma.$transaction(async (tx) => {
      const responded = await tx.rayeRequest.update({
        where: { id: rayeId },
        data: {
          responseText: dto.responseText,
          status: RayeStatus.RESPONDED,
          respondedAt: new Date(),
          assignedTo: raye.assignedTo || user.sub,
        },
        include: this.rayeInclude(),
      });

      await tx.notification.create({
        data: {
          recipientId: raye.requestedBy,
          type: NotificationType.RAYE_RESPONSE_RECEIVED,
          title: 'Raye response received',
          message: `A Raye response was submitted for ${raye.submission.trackingNumber}.`,
          payload: {
            submissionId: raye.submissionId,
            rayeRequestId: rayeId,
            trackingNumber: raye.submission.trackingNumber,
          },
        },
      });

      return responded;
    });

    await this.audit.log({
      submissionId: raye.submissionId,
      actorId: user.sub,
      action: AuditAction.RAYE_RESPONDED,
      metadata: { rayeRequestId: rayeId },
      ipAddress,
    });

    return updated;
  }

  async cancelRaye(rayeId: string, user: JwtPayload, ipAddress: string) {
    const raye = await this.prisma.rayeRequest.findUnique({
      where: { id: rayeId },
      include: this.rayeInclude(),
    });
    if (!raye) throw new NotFoundException('Raye request not found');
    if (raye.status !== RayeStatus.PENDING) {
      throw new BadRequestException('Only pending Raye requests can be cancelled');
    }
    if (user.role !== 'SUPER_ADMIN' && raye.requestedBy !== user.sub) {
      throw new ForbiddenException('Only the requesting officer can cancel this Raye');
    }

    const updated = await this.prisma.rayeRequest.update({
      where: { id: rayeId },
      data: { status: RayeStatus.CANCELLED },
      include: this.rayeInclude(),
    });

    await this.audit.log({
      submissionId: raye.submissionId,
      actorId: user.sub,
      action: AuditAction.RAYE_CANCELLED,
      metadata: { rayeRequestId: rayeId },
      ipAddress,
    });

    return updated;
  }

  async myRayeInbox(user: JwtPayload) {
    const branchIds =
      user.branchId && user.role !== 'SUPER_ADMIN'
        ? await this.getBranchAndDescendantIds(user.branchId)
        : [];

    return this.prisma.rayeRequest.findMany({
      where: {
        status: RayeStatus.PENDING,
        OR: [
          { assignedTo: user.sub },
          ...(branchIds.length > 0
            ? [{ assignedTo: null, targetBranchId: { in: branchIds } }]
            : []),
        ],
      },
      include: this.rayeInclude(),
      orderBy: { requestedAt: 'desc' },
    });
  }

  async listRayeForSubmission(submissionId: string, user: JwtPayload) {
    await this.getScopedSubmission(submissionId, user);

    return this.prisma.rayeRequest.findMany({
      where: { submissionId },
      include: this.rayeInclude(),
      orderBy: { requestedAt: 'desc' },
    });
  }

  async prepareTippani(
    submissionId: string,
    dto: PrepareTippaniInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const context = await this.getActiveSubmissionContext(submissionId);
    await this.ensureCanActOnCurrentStage(
      context,
      user,
      'submission:tippani_prepare',
      undefined,
    );

    const tippaniConfigured =
      context.currentStage.allowedActions.includes(StageAction.TIPPANI) ||
      context.currentStage.requiredDocs.includes('TIPPANI');
    if (!tippaniConfigured && user.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('Tippani is not configured for the current stage');
    }

    if (dto.documentId) {
      const document = await this.prisma.document.findUnique({
        where: { id: dto.documentId },
        select: { submissionId: true },
      });
      if (!document || document.submissionId !== submissionId) {
        throw new NotFoundException('Tippani document not found for this submission');
      }
    }

    const tippani = await this.prisma.$transaction(async (tx) => {
      const referenceDocuments = dto.documentId
        ? Array.from(new Set([...dto.referenceDocuments, dto.documentId]))
        : dto.referenceDocuments;
      const pdf = this.buildTippaniPdf({
        trackingNumber: context.submission.trackingNumber,
        title: context.submission.title,
        workflowName: context.submission.workflow.name,
        stageName: context.currentStage.name,
        subject: dto.subject,
        recommendation: dto.recommendation,
        preparedBy: `${user.email}`,
      });
      const fileName = `tippani-${context.submission.trackingNumber.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`;
      const uploaded = await this.storage.uploadGeneratedFile({
        buffer: pdf,
        fileName,
        mimeType: 'application/pdf',
        folder: `submissions/${context.submission.trackingNumber}/tippani`,
      });
      const generatedDocument = await tx.document.create({
        data: {
          submissionId,
          fileName,
          originalName: fileName,
          mimeType: 'application/pdf',
          sizeBytes: pdf.length,
          sha256: uploaded.sha256,
          storageKey: uploaded.storageKey,
          uploaderId: user.sub,
          stageId: context.currentStage.id,
        },
      });

      return tx.tippaniMetadata.create({
        data: {
          submissionId,
          fileStageId: context.activeFileStage.id,
          documentId: generatedDocument.id,
          preparedBy: user.sub,
          subject: dto.subject,
          recommendation: dto.recommendation,
          referenceDocuments,
        },
        include: {
          preparer: { select: { id: true, firstName: true, lastName: true, designation: true } },
          document: { select: { id: true, originalName: true, sha256: true } },
        },
      });
    });

    await this.audit.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.TIPPANI_PREPARED,
      metadata: {
        tippaniId: tippani.id,
        documentId: tippani.documentId || null,
        referenceDocuments: tippani.referenceDocuments,
      },
      ipAddress,
    });

    return tippani;
  }

  async listTippani(submissionId: string, user: JwtPayload) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { id: submissionId },
      include: {
        workflow: { select: { departmentId: true } },
        branch: { select: { id: true, parentBranchId: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    await this.ensureSubmissionScope(submission, user);

    return this.prisma.tippaniMetadata.findMany({
      where: { submissionId },
      include: {
        preparer: { select: { id: true, firstName: true, lastName: true, designation: true } },
        document: { select: { id: true, originalName: true, sha256: true } },
      },
      orderBy: { preparedAt: 'desc' },
    });
  }

  private async getActiveSubmissionContext(submissionId: string) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { id: submissionId },
      include: {
        workflow: {
          include: {
            department: { select: { id: true, code: true } },
            stages: {
              orderBy: { stageOrder: 'asc' },
              include: { assignedRole: true },
            },
          },
        },
        branch: { select: { id: true, parentBranchId: true } },
        fileStages: {
          where: { status: { in: ACTIVE_STAGE_STATUSES } },
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { stage: { include: { assignedRole: true } } },
        },
      },
    });

    if (!submission) throw new NotFoundException('Submission not found');
    if (!submission.currentStageId) {
      throw new BadRequestException('Submission has no active stage');
    }

    const activeFileStage = submission.fileStages.find(
      (fileStage) => fileStage.stageId === submission.currentStageId,
    );
    if (!activeFileStage) throw new BadRequestException('Active file stage not found');

    const currentStage =
      submission.workflow.stages.find((stage) => stage.id === submission.currentStageId) ||
      activeFileStage.stage;
    if (!currentStage) throw new BadRequestException('Current workflow stage not found');

    return { submission, activeFileStage, currentStage };
  }

  private async getScopedSubmission(submissionId: string, user: JwtPayload) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { id: submissionId },
      include: {
        workflow: { select: { departmentId: true } },
        branch: { select: { id: true, parentBranchId: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    await this.ensureSubmissionScope(submission, user);
    return submission;
  }

  private async ensureCanActOnCurrentStage(
    context: Awaited<ReturnType<DorService['getActiveSubmissionContext']>>,
    user: JwtPayload,
    requiredPermission: string,
    requiredAction?: StageAction,
  ) {
    await this.ensureSubmissionScope(context.submission, user);

    if (!this.hasPermission(user, requiredPermission)) {
      throw new ForbiddenException('Missing permission for this DOR action');
    }

    if (!ADMIN_ROLES.has(user.role)) {
      const assignedToCurrentUser = context.activeFileStage.assignedTo === user.sub;
      const assignedRoleMatches =
        context.currentStage.assignedRole?.code === user.role ||
        context.currentStage.assignedRoleId === user.roleId;
      if (!assignedToCurrentUser && !assignedRoleMatches) {
        throw new ForbiddenException('Submission is not at your assigned stage');
      }
    }

    if (
      requiredAction &&
      user.role !== 'SUPER_ADMIN' &&
      !context.currentStage.allowedActions.includes(requiredAction)
    ) {
      throw new ForbiddenException(`Action ${requiredAction} is not enabled for this stage`);
    }
  }

  private async ensureSubmissionScope(
    submission: {
      contractorId: string;
      branchId: string;
      currentBranchId?: string | null;
      workflow?: { departmentId: string };
    },
    user: JwtPayload,
  ) {
    if (user.role === 'SUPER_ADMIN') return;

    if (user.role === 'CONTRACTOR') {
      if (submission.contractorId !== user.sub) throw new ForbiddenException('Access denied');
      return;
    }

    if (user.departmentId && submission.workflow?.departmentId !== user.departmentId) {
      throw new ForbiddenException('Access denied: department scope mismatch');
    }

    if (user.role === 'DEPARTMENT_ADMIN') return;

    if (!user.branchId) {
      throw new ForbiddenException('Access denied: branch scope is required');
    }

    const routeBranchId = submission.currentBranchId || submission.branchId;
    const branchAndAncestors = await this.getBranchAndAncestorIds(routeBranchId);
    if (!branchAndAncestors.includes(user.branchId)) {
      throw new ForbiddenException('Access denied: branch scope mismatch');
    }
  }

  private resolveTokContinuationStage(
    stages: Array<{
      id: string;
      name: string;
      assignedRoleId: string | null;
      slaDays: number;
      assignedRole?: { code: string } | null;
    }>,
    targetUser: { role: { code: string } },
    targetStageId?: string,
  ) {
    const stage = targetStageId
      ? stages.find((item) => item.id === targetStageId)
      : stages.find((item) => item.assignedRole?.code === targetUser.role.code);

    if (!stage) {
      throw new BadRequestException('No workflow stage matches the Tok recipient');
    }
    if (stage.assignedRole?.code !== targetUser.role.code) {
      throw new ForbiddenException('Tok continuation stage must match the recipient role');
    }

    return stage;
  }

  private resolveActorOfficeBranchId(
    context: Awaited<ReturnType<DorService['getActiveSubmissionContext']>>,
    user: JwtPayload,
  ) {
    return (
      user.branchId ||
      context.activeFileStage.branchId ||
      context.submission.currentBranchId ||
      context.submission.branchId ||
      null
    );
  }

  private buildTippaniPdf(input: {
    trackingNumber: string;
    title: string;
    workflowName: string;
    stageName: string;
    subject: string;
    recommendation: string;
    preparedBy: string;
  }) {
    const lines = [
      'Department of Roads',
      'Tippani',
      '',
      `Tracking Number: ${input.trackingNumber}`,
      `File Title: ${input.title}`,
      `Workflow: ${input.workflowName}`,
      `Stage: ${input.stageName}`,
      `Prepared By: ${input.preparedBy}`,
      `Prepared At: ${new Date().toISOString()}`,
      '',
      `Subject: ${input.subject}`,
      '',
      'Recommendation:',
      ...this.wrapPdfText(input.recommendation, 88),
    ];
    const contentLines = lines
      .slice(0, 42)
      .map((line, index) => `BT /F1 10 Tf 54 ${780 - index * 17} Td (${this.escapePdfText(line)}) Tj ET`)
      .join('\n');
    const stream = Buffer.from(contentLines, 'utf8');
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${contentLines}\nendstream\nendobj\n`,
    ];
    let offset = Buffer.byteLength('%PDF-1.4\n', 'utf8');
    const offsets = [0];
    for (const object of objects) {
      offsets.push(offset);
      offset += Buffer.byteLength(object, 'utf8');
    }
    const xrefOffset = offset;
    const xref = [
      'xref',
      `0 ${objects.length + 1}`,
      '0000000000 65535 f ',
      ...offsets.slice(1).map((item) => `${String(item).padStart(10, '0')} 00000 n `),
      'trailer',
      `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
      'startxref',
      String(xrefOffset),
      '%%EOF',
      '',
    ].join('\n');

    return Buffer.from(`%PDF-1.4\n${objects.join('')}${xref}`, 'utf8');
  }

  private wrapPdfText(text: string, width: number) {
    const words = text.replace(/\s+/g, ' ').trim().split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
      } else if (`${current} ${word}`.length <= width) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
  }

  private escapePdfText(text: string) {
    return text
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private hasPermission(user: JwtPayload, permission: string) {
    return user.permissions?.includes('*') || user.permissions?.includes(permission);
  }

  private async ensureBranchInDepartment(branchId: string, departmentId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { departmentId: true },
    });
    if (!branch) throw new NotFoundException('Target branch not found');
    if (branch.departmentId !== departmentId) {
      throw new ForbiddenException('Target branch must belong to the same department');
    }
  }

  private async ensureUserInDepartment(userId: string, departmentId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, branchId: true, status: true },
    });
    if (!user) throw new NotFoundException('Assigned Raye officer not found');
    if (user.status !== 'ACTIVE') throw new BadRequestException('Assigned Raye officer must be active');
    if (user.departmentId !== departmentId) {
      throw new ForbiddenException('Assigned Raye officer must belong to the same department');
    }
    return user;
  }

  private async getBranchAndAncestorIds(branchId: string) {
    const ids: string[] = [];
    let currentId: string | null = branchId;

    for (let depth = 0; currentId && depth < 20; depth++) {
      const branch: { id: string; parentBranchId: string | null } | null =
        await this.prisma.branch.findUnique({
        where: { id: currentId },
        select: { id: true, parentBranchId: true },
      });
      if (!branch) break;
      ids.push(branch.id);
      currentId = branch.parentBranchId;
    }

    return ids;
  }

  private async getBranchAndDescendantIds(branchId: string) {
    const collected = new Set<string>([branchId]);
    let frontier = [branchId];

    for (let depth = 0; frontier.length > 0 && depth < 20; depth++) {
      const children = await this.prisma.branch.findMany({
        where: { parentBranchId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((branch) => branch.id).filter((id) => !collected.has(id));
      frontier.forEach((id) => collected.add(id));
    }

    return [...collected];
  }

  private tokInclude() {
    return {
      assignedBy: {
        select: { id: true, firstName: true, lastName: true, designation: true },
      },
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, designation: true },
      },
      submission: {
        select: { id: true, trackingNumber: true, title: true, status: true },
      },
      fileStage: {
        select: {
          id: true,
          stage: { select: { id: true, name: true, stageOrder: true } },
        },
      },
    } as const;
  }

  private rayeInclude() {
    return {
      requester: {
        select: { id: true, firstName: true, lastName: true, designation: true },
      },
      assignedOfficer: {
        select: { id: true, firstName: true, lastName: true, designation: true },
      },
      targetBranch: {
        select: { id: true, name: true, code: true, nepaliName: true },
      },
      submission: {
        select: {
          id: true,
          trackingNumber: true,
          title: true,
          status: true,
          contractorId: true,
          branchId: true,
          currentBranchId: true,
          workflow: { select: { departmentId: true } },
        },
      },
      fileStage: {
        select: {
          id: true,
          stage: { select: { id: true, name: true, stageOrder: true } },
        },
      },
    } as const;
  }

  private calculateSlaDueDate(slaDays: number): Date {
    const date = new Date();
    let added = 0;
    while (added < slaDays) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 6) {
        added++;
      }
    }
    return date;
  }
}
