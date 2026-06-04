// =============================================
// Submissions Service — File Lifecycle Management
// =============================================
// Handles: create, forward, reject, hold, track

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  AuditAction,
  SubmissionStatus,
  FileStageStatus,
  WorkflowStatus,
  Role,
  StageAction,
} from '@govflow/shared';
import type {
  ApproveSubmissionInput,
  CreateSubmissionInput,
  ForwardToMinistryInput,
  ForwardSubmissionInput,
  RejectSubmissionInput,
  HoldSubmissionInput,
  AddCommentInput,
  JwtPayload,
} from '@govflow/shared';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private storageService: StorageService,
  ) {}

  /**
   * Create a new file submission (Contractor action).
   * Generates tracking number, assigns to first workflow stage.
   */
  async create(dto: CreateSubmissionInput, user: JwtPayload, ipAddress: string) {
    // Validate branch exists
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const workflow = await this.resolveSubmissionWorkflow(dto, branch.departmentId);
    const metadata = this.validateSubmissionMetadata(workflow, dto.metadata || {});

    const trackingNumber = await this.generateTrackingNumber({
      deptCode: workflow.department.code,
      branchCode: branch.code,
      workflowCode: workflow.code || this.workflowCodeFromName(workflow.name),
    });

    const firstStage = workflow.stages[0];

    // Create submission + first file stage in a transaction
    const submission = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.fileSubmission.create({
        data: {
          trackingNumber,
          contractorId: user.sub,
          workflowId: workflow.id,
          workflowVersion: workflow.version,
          branchId: dto.branchId,
          currentBranchId: dto.branchId,
          status: SubmissionStatus.SUBMITTED,
          currentStageId: firstStage.id,
          title: dto.title,
          description: dto.description || null,
          metadata: metadata as any,
        },
      });

      // Create first file stage
      const slaDueAt = this.calculateSlaDueDate(firstStage.slaDays);
      await tx.fileStage.create({
        data: {
          submissionId: sub.id,
          stageId: firstStage.id,
          branchId: dto.branchId,
          status: FileStageStatus.PENDING,
          slaDueAt,
        },
      });

      return sub;
    });

    await this.auditService.log({
      submissionId: submission.id,
      actorId: user.sub,
      action: AuditAction.FILE_SUBMITTED,
      metadata: {
        trackingNumber,
        workflowId: workflow.id,
        workflowName: workflow.name,
        submissionType: dto.submissionType || workflow.code || workflow.name,
        branchId: dto.branchId,
        title: dto.title,
      },
      ipAddress,
    });

    return submission;
  }

  /**
   * List submissions scoped by user role.
   */
  async findAll(user: JwtPayload, filters: Record<string, string | undefined>) {
    const where: any = {};

    // Scope by role
    if (user.role === 'CONTRACTOR') {
      where.contractorId = user.sub;
    } else if (user.role !== 'SUPER_ADMIN') {
      // Staff see files at their assigned stages in their dept/branch
      if (user.departmentId) {
        where.workflow = { departmentId: user.departmentId };
      }
      if (user.role !== 'DEPARTMENT_ADMIN' && user.branchId) {
        where.currentBranchId = { in: await this.getBranchAndDescendantIds(user.branchId) };
      }
    }

    // Apply optional filters
    if (filters.status) where.status = filters.status;
    if (filters.workflowId) where.workflowId = filters.workflowId;

    return this.prisma.fileSubmission.findMany({
      where,
      include: {
        workflow: { select: { name: true } },
        branch: { select: { name: true } },
        currentBranch: { select: { name: true, code: true } },
        contractor: { select: { firstName: true, lastName: true, companyName: true } },
        fileStages: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            stage: { select: { name: true, assignedRole: { select: { code: true, name: true } } } },
            branch: { select: { id: true, name: true, code: true } },
            assignedOfficer: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get full submission details with timeline.
   */
  async findOne(id: string, user: JwtPayload) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            stages: {
              orderBy: { stageOrder: 'asc' },
              include: { assignedRole: true },
            },
          },
        },
        branch: true,
        currentBranch: true,
        contractor: {
          select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
        },
        fileStages: {
          orderBy: { startedAt: 'asc' },
          include: {
            stage: true,
            branch: true,
            assignedOfficer: { select: { firstName: true, lastName: true, role: true } },
            parallelApprovals: {
              include: {
                officer: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { firstName: true, lastName: true, role: true } },
          },
        },
        signatures: {
          orderBy: { createdAt: 'asc' },
          include: {
            officer: { select: { firstName: true, lastName: true, role: true } },
          },
        },
        documents: {
          orderBy: { createdAt: 'asc' },
          include: {
            uploader: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!submission) throw new NotFoundException('Submission not found');

    // Access check: contractor can only see their own
    if (user.role === 'CONTRACTOR' && submission.contractorId !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
    await this.validateSubmissionScope(submission, user);

    const mappedDocuments = ((submission as any).documents || []).map((doc: any) => {
      const { storageKey: _storageKey, ...safeDocument } = doc;
      return { ...safeDocument, url: null, sizeBytes: Number(doc.sizeBytes) };
    });

    return { ...submission, documents: mappedDocuments };
  }

  async uploadDocument(id: string, file: Express.Multer.File, user: JwtPayload, ip: string) {
    const submission = await this.getSubmissionWithCurrentStage(id);
    if (!submission) throw new NotFoundException('Submission not found');

    // Access check
    if (user.role === 'CONTRACTOR' && submission.contractorId !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
    await this.validateSubmissionScope(submission, user);

    const { storageKey, sha256 } = await this.storageService.uploadFile(
      file,
      `submissions/${submission.trackingNumber}`,
    );

    const document = await this.prisma.document.create({
      data: {
        submissionId: id,
        fileName: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256,
        storageKey,
        uploaderId: user.sub,
        stageId: submission.currentStageId,
      },
    });

    await this.auditService.log({
      submissionId: id,
      actorId: user.sub,
      action: AuditAction.FILE_UPLOADED,
      metadata: { documentId: document.id, fileName: file.originalname, sha256 },
      ipAddress: ip,
    });

    return { ...document, sizeBytes: Number(document.sizeBytes) };
  }

  async getDocumentUrl(submissionId: string, documentId: string, user: JwtPayload, ipAddress: string) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { id: submissionId },
      include: {
        workflow: { select: { departmentId: true } },
        documents: { where: { id: documentId } },
      },
    });

    if (!submission || submission.documents.length === 0) {
      throw new NotFoundException('Document not found');
    }

    await this.validateSubmissionScope(submission, user);

    const document = submission.documents[0];
    const url = await this.storageService.getPresignedUrl(document.storageKey, 300);

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.FILE_DOWNLOADED,
      metadata: { documentId, fileName: document.originalName, sha256: document.sha256 || null },
      ipAddress,
    });

    return { url, expiresInSeconds: 300 };
  }

  async updatePublicTracking(
    submissionId: string,
    publicTrackable: boolean,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { id: submissionId },
      include: { workflow: { select: { departmentId: true } } },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    await this.validateSubmissionScope(submission, user);

    const updated = await this.prisma.fileSubmission.update({
      where: { id: submissionId },
      data: { publicTrackable },
    });

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.PUBLIC_TRACKING_CHANGED,
      metadata: {
        previousValue: submission.publicTrackable,
        newValue: publicTrackable,
      },
      ipAddress,
    });

    return updated;
  }

  async availableActions(submissionId: string, user: JwtPayload) {
    const submission = await this.getSubmissionWithCurrentStage(submissionId);
    await this.validateSubmissionScope(submission, user);

    const currentStage = this.getCurrentWorkflowStage(submission);
    const activeFileStage = this.getActiveFileStage(submission);
    const canAct = this.canActOnStage(submission, currentStage, activeFileStage, user);

    if (!canAct) {
      return {
        submissionId,
        currentStage: this.serializeStage(currentStage),
        canAct: false,
        actions: [],
      };
    }

    const actions: any[] = [];
    const forwardTargets = await this.getAvailableForwardTargets(submission, currentStage, user);
    if (
      this.hasPermission(user, 'submission:forward') &&
      this.isStageActionAllowed(currentStage, StageAction.FORWARD) &&
      forwardTargets.length > 0
    ) {
      actions.push({
        action: StageAction.FORWARD,
        label: 'Forward',
        targets: forwardTargets,
      });
    }

    if (
      this.hasPermission(user, 'submission:approve') &&
      this.isStageActionAllowed(currentStage, StageAction.APPROVE) &&
      !this.approvalBlockedAtCurrentDorThreshold(submission, currentStage)
    ) {
      actions.push({ action: StageAction.APPROVE, label: 'Approve' });
    }

    if (this.hasPermission(user, 'submission:tok_assign') && this.isStageActionAllowed(currentStage, StageAction.TOK)) {
      actions.push({ action: StageAction.TOK, label: 'Tok' });
    }

    if (
      this.hasPermission(user, 'submission:tippani_prepare') &&
      (this.isStageActionAllowed(currentStage, StageAction.TIPPANI) ||
        currentStage.requiredDocs?.includes('TIPPANI'))
    ) {
      actions.push({ action: StageAction.TIPPANI, label: 'Prepare Tippani' });
    }

    if (this.hasPermission(user, 'submission:raye_request') && this.isStageActionAllowed(currentStage, StageAction.RAYE)) {
      actions.push({
        action: StageAction.RAYE,
        label: 'Request Raye',
        sakhaTargets: ['PRABIDHIK', 'PRASASAN', 'LEKHA', 'KAANUN'],
      });
    }

    if (
      (this.hasPermission(user, 'submission:reject_any') || this.hasPermission(user, 'submission:reject_prev')) &&
      this.isStageActionAllowed(currentStage, StageAction.REJECT)
    ) {
      actions.push({
        action: StageAction.REJECT,
        label: 'Return / Reject',
        targets: this.getPriorStageTargets(submission, currentStage),
      });
    }

    if (this.hasPermission(user, 'submission:hold') && this.isStageActionAllowed(currentStage, StageAction.HOLD)) {
      actions.push({ action: StageAction.HOLD, label: 'Hold' });
    }

    if (
      (this.hasPermission(user, 'submission:comment') || this.hasPermission(user, 'submission:respond_query')) &&
      this.isStageActionAllowed(currentStage, StageAction.COMMENT)
    ) {
      actions.push({ action: StageAction.COMMENT, label: 'Comment' });
    }

    if (
      (this.hasPermission(user, 'submission:sign_t1') || this.hasPermission(user, 'submission:sign_t2')) &&
      (this.isStageActionAllowed(currentStage, StageAction.SIGN) ||
        this.isStageActionAllowed(currentStage, StageAction.SIGN_TIER1) ||
        this.isStageActionAllowed(currentStage, StageAction.SIGN_TIER2))
    ) {
      actions.push({ action: StageAction.SIGN, label: 'Sign Document' });
    }

    if (
      this.hasPermission(user, 'submission:forward_to_ministry') &&
      this.isStageActionAllowed(currentStage, StageAction.FORWARD_TO_MINISTRY)
    ) {
      actions.push({ action: StageAction.FORWARD_TO_MINISTRY, label: 'Forward to Ministry' });
    }

    return {
      submissionId,
      currentStage: this.serializeStage(currentStage),
      canAct: true,
      actions,
    };
  }

  /**
   * Forward a file to the next stage.
   */
  async forward(
    submissionId: string,
    dto: ForwardSubmissionInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const submission = await this.getSubmissionWithCurrentStage(submissionId);

    // Validate user can act on current stage
    await this.validateStageAccess(submission, user, StageAction.FORWARD);

    const currentStage = submission.workflow.stages.find(
      (s: any) => s.id === submission.currentStageId,
    );
    if (!currentStage) throw new BadRequestException('Current stage not found in workflow');

    let moveNext = true;

    if (currentStage.stageType === 'PARALLEL') {
      const fileStage = await this.prisma.fileStage.findFirst({
        where: { submissionId, stageId: currentStage.id, status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] } },
        include: { parallelApprovals: true },
      });

      if (!fileStage) throw new BadRequestException('Active file stage not found');

      const existingApproval = fileStage.parallelApprovals.find((pa) => pa.officerId === user.sub);
      if (existingApproval) throw new BadRequestException('You have already approved this stage');

      await this.prisma.parallelApproval.create({
        data: {
          fileStageId: fileStage.id,
          officerId: user.sub,
          decision: 'APPROVED',
          comment: dto.comment,
        },
      });

      const config = currentStage.parallelConfig;
      const approvalCount = fileStage.parallelApprovals.length + 1;

      if (config?.strategy === 'ALL_MUST_APPROVE') {
        const roleUsers = await this.prisma.user.count({ where: { roleId: currentStage.assignedRoleId, departmentId: submission.workflow.departmentId } });
        if (approvalCount < roleUsers) moveNext = false;
      } else if (config?.strategy === 'QUORUM') {
        if (approvalCount < (config.quorumCount || 1)) moveNext = false;
      }
    }

    if (!moveNext) {
      await this.auditService.log({
        submissionId,
        actorId: user.sub,
        action: 'PARALLEL_APPROVAL_RECORDED' as any,
        metadata: { stage: currentStage.name, comment: dto.comment },
        ipAddress,
      });
      return this.findOne(submissionId, user);
    }

    await this.ensureStageExitRequirements(submissionId, currentStage);

    await this.ensureForwardTargetAllowed(submission, currentStage, dto, user);
    const route = await this.resolveNextRouteForForward(submission, currentStage, dto);
    const nextStage = route.stage;

    // Complete current file stage
    await this.completeActiveFileStage(submissionId, submission.currentStageId!, user.sub);

    if (nextStage) {
      // Create new file stage for next stage
      const slaDueAt = this.calculateSlaDueDate(nextStage.slaDays);
      await this.prisma.fileStage.create({
        data: {
          submissionId,
          stageId: nextStage.id,
          branchId: route.branchId,
          assignedTo: route.assignedTo,
          status: FileStageStatus.PENDING,
          slaDueAt,
        },
      });

      await this.prisma.fileSubmission.update({
        where: { id: submissionId },
        data: {
          currentStageId: nextStage.id,
          currentBranchId: route.branchId,
          status: SubmissionStatus.IN_REVIEW,
        },
      });
    } else {
      // No more stages — file is approved
      await this.prisma.fileSubmission.update({
        where: { id: submissionId },
        data: {
          currentStageId: null,
          status: SubmissionStatus.APPROVED,
        },
      });
    }

    const auditAction = nextStage ? AuditAction.FILE_FORWARDED : AuditAction.FILE_APPROVED;
    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: auditAction,
      metadata: {
        fromStage: currentStage.name,
        toStage: nextStage?.name || 'APPROVED',
        toBranchId: route.branchId || null,
        assignedTo: route.assignedTo || null,
        dynamicRoute: Boolean(dto.targetStageId || dto.targetBranchId || dto.assignedTo),
        comment: dto.comment,
        thresholdApproved: !nextStage && this.shouldApproveAtCurrentDorThreshold(submission, currentStage),
      },
      ipAddress,
    });

    return this.findOne(submissionId, user);
  }

  /**
   * Approve a file at the current stage.
   */
  async approve(
    submissionId: string,
    dto: ApproveSubmissionInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const submission = await this.getSubmissionWithCurrentStage(submissionId);
    await this.validateStageAccess(submission, user, StageAction.APPROVE);

    const currentStage = submission.workflow.stages.find(
      (s: any) => s.id === submission.currentStageId,
    );
    if (!currentStage) throw new BadRequestException('Current stage not found');

    this.ensureApprovalAllowedAtCurrentDorThreshold(submission, currentStage);
    await this.ensureStageExitRequirements(submissionId, currentStage);
    await this.completeActiveFileStage(submissionId, submission.currentStageId!, user.sub);

    await this.prisma.fileSubmission.update({
      where: { id: submissionId },
      data: {
        currentStageId: null,
        status: SubmissionStatus.APPROVED,
      },
    });

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.FILE_APPROVED,
      metadata: {
        stage: currentStage.name,
        comment: dto.comment,
      },
      ipAddress,
    });

    return this.findOne(submissionId, user);
  }

  /**
   * Mark a file as forwarded outside GovFlow to the Ministry.
   */
  async forwardToMinistry(
    submissionId: string,
    dto: ForwardToMinistryInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const submission = await this.getSubmissionWithCurrentStage(submissionId);
    await this.validateStageAccess(submission, user, StageAction.FORWARD_TO_MINISTRY);

    const currentStage = submission.workflow.stages.find(
      (s: any) => s.id === submission.currentStageId,
    );
    if (!currentStage) throw new BadRequestException('Current stage not found');

    if (!this.isStageActionAllowed(currentStage, StageAction.FORWARD_TO_MINISTRY)) {
      throw new ForbiddenException('Forward to Ministry is not enabled for this stage');
    }

    await this.ensureStageExitRequirements(submissionId, currentStage);
    await this.completeActiveFileStage(submissionId, submission.currentStageId!, user.sub);

    await this.prisma.fileSubmission.update({
      where: { id: submissionId },
      data: {
        currentStageId: null,
        status: SubmissionStatus.FORWARDED_TO_MINISTRY,
      },
    });

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.FORWARDED_TO_MINISTRY,
      metadata: {
        stage: currentStage.name,
        ministryReference: dto.ministryReference || null,
        comment: dto.comment || null,
      },
      ipAddress,
    });

    return this.findOne(submissionId, user);
  }

  /**
   * Reject a file to a specified prior stage.
   */
  async reject(
    submissionId: string,
    dto: RejectSubmissionInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const submission = await this.getSubmissionWithCurrentStage(submissionId);
    await this.validateStageAccess(submission, user, StageAction.REJECT);

    const currentStage = submission.workflow.stages.find(
      (s: any) => s.id === submission.currentStageId,
    );
    if (!currentStage) throw new BadRequestException('Current stage not found');

    // Validate target stage exists and is prior
    const targetStage = submission.workflow.stages.find(
      (s: any) => s.id === dto.targetStageId,
    );
    if (!targetStage) throw new NotFoundException('Target stage not found');
    if (targetStage.stageOrder >= currentStage.stageOrder) {
      throw new BadRequestException('Can only reject to a prior stage');
    }

    const previousTargetFileStage = await this.prisma.fileStage.findFirst({
      where: { submissionId, stageId: targetStage.id },
      orderBy: { startedAt: 'desc' },
      select: { branchId: true, assignedTo: true },
    });
    const returnBranchId =
      previousTargetFileStage?.branchId ||
      submission.currentBranchId ||
      submission.branchId;

    // Complete current stage as rejected
    await this.prisma.fileStage.updateMany({
      where: {
        submissionId,
        stageId: submission.currentStageId!,
        status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] },
      },
      data: {
        status: FileStageStatus.REJECTED,
        completedAt: new Date(),
        assignedTo: user.sub,
      },
    });

    // Create new file stage at the target stage
    const slaDueAt = this.calculateSlaDueDate(targetStage.slaDays);
    await this.prisma.fileStage.create({
      data: {
        submissionId,
        stageId: targetStage.id,
        branchId: returnBranchId,
        assignedTo: previousTargetFileStage?.assignedTo || null,
        status: FileStageStatus.PENDING,
        slaDueAt,
      },
    });

    await this.prisma.fileSubmission.update({
      where: { id: submissionId },
      data: {
        currentStageId: targetStage.id,
        currentBranchId: returnBranchId,
        status: SubmissionStatus.IN_REVIEW,
      },
    });

    // Add rejection comment
    await this.prisma.comment.create({
      data: {
        submissionId,
        stageId: currentStage.id,
        authorId: user.sub,
        text: dto.reason,
        commentType: 'COMMENT',
      },
    });

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.FILE_REJECTED,
      metadata: {
        fromStage: currentStage.name,
        toStage: targetStage.name,
        reason: dto.reason,
        requiredCorrections: dto.requiredCorrections,
      },
      ipAddress,
    });

    return this.findOne(submissionId, user);
  }

  /**
   * Put a file on hold.
   */
  async hold(
    submissionId: string,
    dto: HoldSubmissionInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const submission = await this.getSubmissionWithCurrentStage(submissionId);
    await this.validateStageAccess(submission, user, StageAction.HOLD);

    await this.prisma.fileSubmission.update({
      where: { id: submissionId },
      data: { status: SubmissionStatus.ON_HOLD },
    });

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.FILE_HELD,
      metadata: { reason: dto.reason },
      ipAddress,
    });

    return this.findOne(submissionId, user);
  }

  /**
   * Add a comment to a submission.
   */
  async addComment(
    submissionId: string,
    dto: AddCommentInput,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { id: submissionId },
      include: { workflow: { select: { departmentId: true } } },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    await this.validateSubmissionScope(submission, user);

    const comment = await this.prisma.comment.create({
      data: {
        submissionId,
        stageId: submission.currentStageId,
        authorId: user.sub,
        text: dto.text,
        commentType: dto.commentType,
      },
    });

    const auditAction =
      dto.commentType === 'QUERY'
        ? AuditAction.QUERY_RAISED
        : dto.commentType === 'RESPONSE'
          ? AuditAction.QUERY_RESPONDED
          : AuditAction.COMMENT_ADDED;

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: auditAction,
      metadata: { text: dto.text, commentType: dto.commentType },
      ipAddress,
    });

    return comment;
  }

  /**
   * Sign a submission using a PIN (Tier 1 Digital Signature).
   */
  async sign(
    submissionId: string,
    pin: string,
    user: JwtPayload,
    ipAddress: string,
  ) {
    const submission = await this.getSubmissionWithCurrentStage(submissionId);
    await this.validateStageAccess(submission, user, StageAction.SIGN_TIER1);
    const documentsMissingHash = (submission.documents || []).filter((doc: any) => !doc.sha256);
    if (documentsMissingHash.length > 0) {
      throw new BadRequestException('All documents must have a recorded content hash before signing');
    }
    
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!dbUser?.signaturePin) {
      throw new BadRequestException('You have not set up a digital signature PIN');
    }

    const isValid = await bcrypt.compare(pin, dbUser.signaturePin);
    if (!isValid) throw new ForbiddenException('Invalid PIN');

    const signedAt = new Date();
    const documentHash = crypto.createHash('sha256')
      .update(this.buildSignaturePayload(submission, signedAt))
      .digest('hex');
    
    const signatureDataPayload = documentHash + user.sub;
    const hmacSecret = process.env.JWT_SECRET!;
    const signatureData = crypto.createHmac('sha256', hmacSecret).update(signatureDataPayload).digest('hex');

    const signature = await this.prisma.digitalSignature.create({
      data: {
        submissionId,
        officerId: user.sub,
        tier: 1,
        documentHash,
        signatureData,
        ipAddress,
      },
    });

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.DOCUMENT_SIGNED,
      metadata: { signatureId: signature.id, tier: 1 },
      ipAddress,
    });

    return signature;
  }

  /**
   * Verify a Digital Signature
   */
  async verifySignature(signatureId: string) {
    const signature = await this.prisma.digitalSignature.findUnique({
      where: { id: signatureId },
      include: {
        officer: { select: { role: { select: { name: true } } } },
        submission: { select: { trackingNumber: true, title: true } }
      }
    });

    if (!signature) throw new NotFoundException('Signature not found');

    const documentHash = signature.documentHash;
    const signatureDataPayload = documentHash + signature.officerId;
    const hmacSecret = process.env.JWT_SECRET!;
    const expectedSignatureData = crypto.createHmac('sha256', hmacSecret).update(signatureDataPayload).digest('hex');

    const isValid = signature.signatureData === expectedSignatureData && /^[a-f0-9]{64}$/.test(signature.documentHash);

    return {
      isValid,
      tier: signature.tier,
      signedAt: signature.createdAt,
      role: signature.officer.role.name,
      trackingNumber: signature.submission.trackingNumber,
      documentTitle: signature.submission.title,
    };
  }

  /**
   * Public tracking — returns sanitized info (no officer names).
   */
  async track(trackingNumber: string) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { trackingNumber },
      include: {
        workflow: { select: { name: true } },
        fileStages: {
          orderBy: { startedAt: 'asc' },
          include: {
            stage: { select: { name: true, stageOrder: true } },
          },
        },
      },
    });

    if (!submission || !submission.publicTrackable) throw new NotFoundException('Tracking number not found');

    const activeStage = submission.fileStages.find((fs: any) =>
      [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS].includes(fs.status),
    );
    const expectedCompletionAt = activeStage?.slaDueAt || null;
    const now = new Date();
    const remainingSlaDays = expectedCompletionAt
      ? Math.ceil((expectedCompletionAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    // Return sanitized public data only. Do not expose officers, comments, documents, or internal routing notes.
    return {
      trackingNumber: submission.trackingNumber,
      title: submission.title,
      workflowName: submission.workflow.name,
      status: submission.status,
      submittedAt: submission.createdAt,
      expectedCompletionAt,
      remainingSlaDays,
      currentStep: activeStage
        ? {
            stageName: activeStage.stage.name,
            status: activeStage.status,
            receivedAt: activeStage.startedAt,
          }
        : null,
      stages: submission.fileStages.map((fs: any) => ({
        stageName: fs.stage.name,
        status: fs.status,
        receivedAt: fs.startedAt,
        completedAt: fs.completedAt,
      })),
    };
  }

  // ---- Private Helpers ----

  private async getSubmissionWithCurrentStage(submissionId: string) {
    const submission = await this.prisma.fileSubmission.findUnique({
      where: { id: submissionId },
      include: {
        workflow: {
          include: {
            stages: {
              orderBy: { stageOrder: 'asc' },
              include: { assignedRole: true, parallelConfig: true, routingRules: true },
            },
          },
        },
        documents: true,
        fileStages: {
          where: { status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] } },
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { branch: true, assignedOfficer: { include: { role: true } } },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (!submission.currentStageId) {
      throw new BadRequestException('File has already been approved or archived');
    }
    return submission;
  }

  private getCurrentWorkflowStage(submission: any) {
    const currentStage = submission.workflow.stages.find(
      (stage: any) => stage.id === submission.currentStageId,
    );
    if (!currentStage) throw new BadRequestException('Current stage configuration not found');
    return currentStage;
  }

  private getActiveFileStage(submission: any) {
    return submission.fileStages?.find(
      (fileStage: any) => fileStage.stageId === submission.currentStageId,
    );
  }

  private canActOnStage(submission: any, currentStage: any, activeFileStage: any, user: JwtPayload) {
    if (user.role === 'SUPER_ADMIN') return true;
    const assignedToCurrentUser = activeFileStage?.assignedTo === user.sub;
    const assignedRoleMatches =
      currentStage.assignedRole?.code === user.role ||
      currentStage.assignedRoleId === user.roleId;
    return assignedToCurrentUser || assignedRoleMatches;
  }

  private serializeStage(stage: any) {
    return {
      id: stage.id,
      name: stage.name,
      stageOrder: stage.stageOrder,
      assignedRoleId: stage.assignedRoleId,
      assignedRole: stage.assignedRole
        ? { id: stage.assignedRole.id, name: stage.assignedRole.name, code: stage.assignedRole.code }
        : null,
    };
  }

  private hasPermission(user: JwtPayload, permission: string) {
    return user.permissions?.includes('*') || user.permissions?.includes(permission);
  }

  private async getAvailableForwardTargets(submission: any, currentStage: any, user: JwtPayload) {
    if (this.shouldApproveAtCurrentDorThreshold(submission, currentStage)) return [];

    const policyStages = this.getAvailableForwardStages(submission, currentStage, user);
    if (policyStages.length === 0) return [];

    const routeBranchId = submission.currentBranchId || submission.branchId;
    const branches = await this.getForwardBranchTargets(submission, user, routeBranchId);
    const branchTargets = branches.length > 0
      ? branches
      : [{ id: routeBranchId, name: null, code: null, branchLevel: null, clusterType: null }];

    const targets: any[] = [];
    for (const stagePolicy of policyStages) {
      for (const branch of branchTargets) {
        targets.push({
          targetStageId: stagePolicy.stage.id,
          stageName: stagePolicy.stage.name,
          stageOrder: stagePolicy.stage.stageOrder,
          assignedRoleId: stagePolicy.stage.assignedRoleId,
          assignedRole: stagePolicy.stage.assignedRole
            ? {
                id: stagePolicy.stage.assignedRole.id,
                name: stagePolicy.stage.assignedRole.name,
                code: stagePolicy.stage.assignedRole.code,
              }
            : null,
          targetBranchId: branch.id,
          branchName: branch.name,
          branchCode: branch.code,
          branchLevel: branch.branchLevel,
          clusterType: branch.clusterType,
          recommended: stagePolicy.recommended,
          reason: stagePolicy.reason,
        });
      }
    }

    return targets;
  }

  private getAvailableForwardStages(submission: any, currentStage: any, user: JwtPayload) {
    const stagesById = new Map(submission.workflow.stages.map((stage: any) => [stage.id, stage]));
    const policies = new Map<string, { stage: any; recommended: boolean; reason: string }>();
    const addStage = (stage: any, recommended: boolean, reason: string) => {
      if (!stage || stage.id === currentStage.id) return;
      const existing = policies.get(stage.id);
      if (!existing || recommended) {
        policies.set(stage.id, { stage, recommended: existing?.recommended || recommended, reason });
      }
    };

    const routedStage = this.resolveStageFromRoutingRules(submission, currentStage);
    if (routedStage) {
      addStage(routedStage, true, 'Matches configured routing rule');
    }

    const nextStage = submission.workflow.stages.find(
      (stage: any) => stage.stageOrder === currentStage.stageOrder + 1,
    );
    addStage(nextStage, !routedStage, routedStage ? 'Next sequential stage' : 'Recommended next stage');

    const canChooseBroadly = user.role === 'SUPER_ADMIN' || user.role === 'DEPARTMENT_ADMIN';
    if (canChooseBroadly) {
      for (const stage of submission.workflow.stages) {
        addStage(stage, false, 'Administrative dynamic route');
      }
    } else {
      for (const stage of submission.workflow.stages) {
        if (stage.stageOrder > currentStage.stageOrder) {
          addStage(stage, false, 'Higher authority stage');
        }
      }
    }

    return [...policies.values()].sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      return a.stage.stageOrder - b.stage.stageOrder;
    }).filter((policy) => stagesById.has(policy.stage.id));
  }

  private async getForwardBranchTargets(submission: any, user: JwtPayload, routeBranchId: string) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'DEPARTMENT_ADMIN') {
      return this.prisma.branch.findMany({
        where: { departmentId: submission.workflow.departmentId },
        select: {
          id: true,
          name: true,
          code: true,
          branchLevel: true,
          clusterType: true,
        },
        orderBy: [{ branchLevel: 'desc' }, { name: 'asc' }],
      });
    }

    const ancestorIds = await this.getBranchAndAncestorIds(routeBranchId);
    if (ancestorIds.length === 0) return [];

    return this.prisma.branch.findMany({
      where: { id: { in: ancestorIds } },
      select: {
        id: true,
        name: true,
        code: true,
        branchLevel: true,
        clusterType: true,
      },
      orderBy: [{ branchLevel: 'asc' }, { name: 'asc' }],
    });
  }

  private getPriorStageTargets(submission: any, currentStage: any) {
    const seen = new Set<string>();
    return (submission.fileStages || [])
      .map((fileStage: any) => fileStage.stage)
      .filter((stage: any) => stage && stage.id !== currentStage.id && stage.stageOrder < currentStage.stageOrder)
      .filter((stage: any) => {
        if (seen.has(stage.id)) return false;
        seen.add(stage.id);
        return true;
      })
      .map((stage: any) => this.serializeStage(stage));
  }

  private async ensureForwardTargetAllowed(
    submission: any,
    currentStage: any,
    dto: ForwardSubmissionInput,
    user: JwtPayload,
  ) {
    if (!dto.targetStageId && !dto.targetBranchId) return;

    const targetStage = dto.targetStageId
      ? submission.workflow.stages.find((stage: any) => stage.id === dto.targetStageId)
      : this.resolveNextStageForForward(submission, currentStage);
    if (dto.targetStageId && !targetStage) {
      throw new NotFoundException('Target stage not found');
    }

    const targets = await this.getAvailableForwardTargets(submission, currentStage, user);
    const matchingStageTargets = targets.filter((target) => target.targetStageId === targetStage?.id);
    if (targetStage && matchingStageTargets.length === 0) {
      throw new ForbiddenException('Target stage is not available for this file');
    }

    if (dto.targetBranchId && !matchingStageTargets.some((target) => target.targetBranchId === dto.targetBranchId)) {
      throw new ForbiddenException('Target office is not available for this file');
    }
  }

  private async validateStageAccess(submission: any, user: JwtPayload, action: StageAction) {
    // Super admin can always act
    if (user.role === 'SUPER_ADMIN') return;
    await this.validateSubmissionScope(submission, user);

    const currentStage = submission.workflow.stages.find(
      (s: any) => s.id === submission.currentStageId,
    );
    if (!currentStage) {
      throw new BadRequestException('Current stage configuration not found');
    }

    const activeFileStage = submission.fileStages?.find(
      (fileStage: any) => fileStage.stageId === submission.currentStageId,
    );
    const assignedToCurrentUser = activeFileStage?.assignedTo === user.sub;

    // Check role matches stage's assigned role
    if (
      !assignedToCurrentUser &&
      currentStage.assignedRole?.code !== user.role &&
      currentStage.assignedRoleId !== user.roleId
    ) {
      throw new ForbiddenException(
        `This stage requires role: ${currentStage.assignedRole?.name || 'Unknown'}`,
      );
    }

    // Check action is allowed at this stage
    if (!this.isStageActionAllowed(currentStage, action)) {
      throw new ForbiddenException(
        `Action '${action}' is not allowed at this stage`,
      );
    }
  }

  private isStageActionAllowed(stage: { allowedActions?: string[] }, action: StageAction) {
    const allowedActions = stage.allowedActions || [];
    if (allowedActions.includes(action)) return true;

    if (
      (action === StageAction.SIGN_TIER1 || action === StageAction.SIGN_TIER2) &&
      allowedActions.includes(StageAction.SIGN)
    ) {
      return true;
    }

    if (action === StageAction.REJECT && allowedActions.includes(StageAction.REJECT_ANY)) {
      return true;
    }

    return false;
  }

  private async ensureStageExitRequirements(
    submissionId: string,
    currentStage: { id: string; name: string; requiredDocs?: string[] },
  ) {
    if (!currentStage.requiredDocs?.includes('TIPPANI')) return;

    const activeFileStage = await this.prisma.fileStage.findFirst({
      where: {
        submissionId,
        stageId: currentStage.id,
        status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] },
      },
      select: { id: true },
    });
    if (!activeFileStage) throw new BadRequestException('Active file stage not found');

    const tippaniCount = await this.prisma.tippaniMetadata.count({
      where: {
        submissionId,
        fileStage: { stageId: currentStage.id },
      },
    });
    if (tippaniCount === 0) {
      throw new BadRequestException(`Tippani is required before leaving ${currentStage.name}`);
    }
  }

  private async completeActiveFileStage(
    submissionId: string,
    stageId: string,
    actorId: string,
  ) {
    await this.prisma.fileStage.updateMany({
      where: {
        submissionId,
        stageId,
        status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] },
      },
      data: {
        status: FileStageStatus.COMPLETED,
        completedAt: new Date(),
        assignedTo: actorId,
      },
    });
  }

  private resolveNextStageForForward(submission: any, currentStage: any) {
    if (this.shouldApproveAtCurrentDorThreshold(submission, currentStage)) {
      return null;
    }

    const routedStage = this.resolveStageFromRoutingRules(submission, currentStage);
    if (routedStage) {
      return routedStage;
    }

    return submission.workflow.stages.find(
      (stage: any) => stage.stageOrder === currentStage.stageOrder + 1,
    );
  }

  private resolveStageFromRoutingRules(submission: any, currentStage: any) {
    const rules = currentStage.routingRules || [];
    if (rules.length === 0) return null;

    const matchingRule = rules.find((rule: any) => this.routingRuleMatches(submission, rule));
    if (!matchingRule) return null;

    const targetStage = submission.workflow.stages.find(
      (stage: any) => stage.id === matchingRule.targetStageId,
    );
    if (!targetStage) {
      throw new BadRequestException(`Routing rule target stage not found for ${currentStage.name}`);
    }
    if (targetStage.id === currentStage.id) {
      throw new BadRequestException(`Routing rule for ${currentStage.name} targets the current stage`);
    }

    return targetStage;
  }

  private routingRuleMatches(submission: any, rule: any) {
    const actual = this.getRoutingFieldValue(submission, rule.conditionField);
    if (actual === undefined || actual === null) return false;

    const expected = rule.value;
    switch (rule.operator) {
      case 'gt':
        return this.compareNumbers(actual, expected, (a, b) => a > b);
      case 'gte':
        return this.compareNumbers(actual, expected, (a, b) => a >= b);
      case 'lt':
        return this.compareNumbers(actual, expected, (a, b) => a < b);
      case 'lte':
        return this.compareNumbers(actual, expected, (a, b) => a <= b);
      case 'eq':
        return String(actual) === String(expected);
      case 'not_eq':
        return String(actual) !== String(expected);
      case 'contains':
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      default:
        throw new BadRequestException(`Unsupported routing operator: ${rule.operator}`);
    }
  }

  private getRoutingFieldValue(submission: any, conditionField: string) {
    const normalizedField = conditionField.trim();
    if (normalizedField.startsWith('metadata.')) {
      return submission.metadata?.[normalizedField.slice('metadata.'.length)];
    }

    if (Object.prototype.hasOwnProperty.call(submission.metadata || {}, normalizedField)) {
      return submission.metadata[normalizedField];
    }

    return submission[normalizedField];
  }

  private compareNumbers(
    actual: unknown,
    expected: unknown,
    comparator: (actual: number, expected: number) => boolean,
  ) {
    const actualNumber = Number(actual);
    const expectedNumber = Number(expected);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;
    return comparator(actualNumber, expectedNumber);
  }

  private async resolveSubmissionWorkflow(dto: CreateSubmissionInput, departmentId: string) {
    const include = {
      department: { select: { id: true, code: true } },
      stages: {
        orderBy: { stageOrder: 'asc' as const },
        include: { assignedRole: true },
      },
    };

    const workflow = dto.workflowId
      ? await this.prisma.workflowDefinition.findUnique({
          where: { id: dto.workflowId },
          include,
        })
      : await this.prisma.workflowDefinition.findFirst({
          where: {
            departmentId,
            status: WorkflowStatus.ACTIVE,
            OR: [
              { code: this.normalizeWorkflowCode(dto.submissionType || '') },
              { name: { contains: dto.submissionType || '', mode: 'insensitive' } },
            ],
          },
          include,
          orderBy: [{ version: 'desc' }, { name: 'asc' }],
        });

    if (!workflow) throw new NotFoundException('Workflow not found for submission type');
    if (workflow.department.id !== departmentId) {
      throw new ForbiddenException('Workflow must belong to the selected office department');
    }
    if (workflow.status !== WorkflowStatus.ACTIVE) {
      throw new BadRequestException('Workflow is not active');
    }
    if (workflow.stages.length === 0) {
      throw new BadRequestException('Workflow has no stages');
    }

    return workflow;
  }

  private validateSubmissionMetadata(
    workflow: { metadataSchema?: unknown; name: string },
    metadata: Record<string, unknown>,
  ) {
    const schema = Array.isArray(workflow.metadataSchema) ? workflow.metadataSchema : [];
    const normalized: Record<string, unknown> = { ...metadata };

    for (const rawField of schema) {
      if (!rawField || typeof rawField !== 'object') continue;
      const field = rawField as {
        key?: unknown;
        label?: unknown;
        type?: unknown;
        required?: unknown;
      };
      if (typeof field.key !== 'string' || field.key.trim().length === 0) continue;

      const key = field.key;
      const label = typeof field.label === 'string' && field.label.trim() ? field.label : key;
      const value = normalized[key];
      const missing = value === undefined || value === null || value === '';
      if (field.required && missing) {
        throw new BadRequestException(`${label} is required for ${workflow.name}`);
      }
      if (missing) continue;

      const type = typeof field.type === 'string' ? field.type.toUpperCase() : 'TEXT';
      if (type === 'NUMBER') {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          throw new BadRequestException(`${label} must be a valid number`);
        }
        normalized[key] = numericValue;
        continue;
      }

      if (type === 'BOOLEAN') {
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`${label} must be true or false`);
        }
        continue;
      }

      if (type === 'DATE') {
        const dateValue = new Date(String(value));
        if (Number.isNaN(dateValue.getTime())) {
          throw new BadRequestException(`${label} must be a valid date`);
        }
        normalized[key] = dateValue.toISOString();
        continue;
      }

      if (typeof value !== 'string') {
        throw new BadRequestException(`${label} must be text`);
      }
      const sanitizedValue = value.replace(/<[^>]*>/g, '').trim();
      if (field.required && sanitizedValue.length === 0) {
        throw new BadRequestException(`${label} is required for ${workflow.name}`);
      }
      normalized[key] = sanitizedValue;
    }

    return normalized;
  }

  private async resolveNextRouteForForward(
    submission: any,
    currentStage: any,
    dto: ForwardSubmissionInput,
  ) {
    const nextStage = dto.targetStageId
      ? submission.workflow.stages.find((stage: any) => stage.id === dto.targetStageId)
      : this.resolveNextStageForForward(submission, currentStage);

    if (dto.targetStageId && !nextStage) {
      throw new NotFoundException('Target stage not found');
    }
    if (dto.targetStageId && nextStage.id === currentStage.id) {
      throw new BadRequestException('Select a different target stage');
    }

    if (!nextStage) {
      return {
        stage: null,
        branchId: submission.currentBranchId || submission.branchId,
        assignedTo: null,
      };
    }

    let branchId: string | null = dto.targetBranchId || submission.currentBranchId || submission.branchId;
    let assignedTo: string | null = dto.assignedTo || null;

    if (dto.targetBranchId) {
      await this.ensureBranchInDepartment(dto.targetBranchId, submission.workflow.departmentId);
    }

    if (assignedTo) {
      const officer = await this.prisma.user.findUnique({
        where: { id: assignedTo },
        select: {
          id: true,
          status: true,
          departmentId: true,
          branchId: true,
          roleId: true,
          role: { select: { code: true } },
        },
      });
      if (!officer) throw new NotFoundException('Assigned officer not found');
      if (officer.status !== 'ACTIVE') throw new BadRequestException('Assigned officer must be active');
      if (officer.departmentId !== submission.workflow.departmentId) {
        throw new ForbiddenException('Assigned officer must belong to the workflow department');
      }
      if (
        nextStage.assignedRoleId &&
        officer.roleId !== nextStage.assignedRoleId &&
        officer.role?.code !== nextStage.assignedRole?.code
      ) {
        throw new ForbiddenException('Assigned officer role does not match the target stage');
      }

      if (dto.targetBranchId) {
        const branchIds = await this.getBranchAndDescendantIds(dto.targetBranchId);
        if (!officer.branchId || !branchIds.includes(officer.branchId)) {
          throw new ForbiddenException('Assigned officer must belong to the target office hierarchy');
        }
      } else if (officer.branchId) {
        branchId = officer.branchId;
      }
    }

    if (branchId) {
      await this.ensureBranchInDepartment(branchId, submission.workflow.departmentId);
    }

    return { stage: nextStage, branchId, assignedTo };
  }

  private shouldApproveAtCurrentDorThreshold(submission: any, currentStage: any) {
    if (submission.workflow?.code !== 'VO') return false;

    const voPercentage = Number(submission.metadata?.vo_percentage);
    if (!Number.isFinite(voPercentage)) return false;

    const roleCode = currentStage.assignedRole?.code;
    return (
      (roleCode === 'SENIOR_ENGINEER' && voPercentage < 10) ||
      (roleCode === 'SUPERINTENDENT_ENGINEER' && voPercentage < 15)
    );
  }

  private ensureApprovalAllowedAtCurrentDorThreshold(submission: any, currentStage: any) {
    if (submission.workflow?.code !== 'VO') return;

    const voPercentage = Number(submission.metadata?.vo_percentage);
    if (!Number.isFinite(voPercentage)) return;

    const roleCode = currentStage.assignedRole?.code;
    if (roleCode === 'SENIOR_ENGINEER' && voPercentage >= 10) {
      throw new ForbiddenException(
        'VO percentage is 10% or higher and must be forwarded to the Superintending Engineer',
      );
    }
    if (roleCode === 'SUPERINTENDENT_ENGINEER' && voPercentage >= 15) {
      throw new ForbiddenException(
        'VO percentage is 15% or higher and must be forwarded to DOR HQ',
      );
    }
  }

  private approvalBlockedAtCurrentDorThreshold(submission: any, currentStage: any) {
    if (submission.workflow?.code !== 'VO') return false;

    const voPercentage = Number(submission.metadata?.vo_percentage);
    if (!Number.isFinite(voPercentage)) return false;

    const roleCode = currentStage.assignedRole?.code;
    return (
      (roleCode === 'SENIOR_ENGINEER' && voPercentage >= 10) ||
      (roleCode === 'SUPERINTENDENT_ENGINEER' && voPercentage >= 15)
    );
  }

  private async validateSubmissionScope(submission: any, user: JwtPayload) {
    if (user.role === 'SUPER_ADMIN') return;

    if (user.role === 'CONTRACTOR') {
      if (submission.contractorId !== user.sub) {
        throw new ForbiddenException('Access denied');
      }
      return;
    }

    if (
      user.departmentId &&
      submission.workflow?.departmentId &&
      submission.workflow.departmentId !== user.departmentId
    ) {
      throw new ForbiddenException('Access denied: department scope mismatch');
    }

    if (user.role === 'DEPARTMENT_ADMIN') return;

    const routeBranchId = submission.currentBranchId || submission.branchId;

    if (!user.branchId && routeBranchId) {
      throw new ForbiddenException('Access denied: branch scope is required');
    }

    if (
      user.branchId &&
      routeBranchId &&
      routeBranchId !== user.branchId &&
      !(await this.isBranchAncestorOrSelf(user.branchId, routeBranchId))
    ) {
      throw new ForbiddenException('Access denied: branch scope mismatch');
    }
  }

  private buildSignaturePayload(submission: any, signedAt: Date): string {
    return JSON.stringify({
      trackingNumber: submission.trackingNumber,
      workflowId: submission.workflowId,
      workflowVersion: submission.workflowVersion,
      title: submission.title,
      createdAt: submission.createdAt.toISOString(),
      signedAt: signedAt.toISOString(),
      documents: (submission.documents || [])
        .map((doc: any) => ({
          id: doc.id,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          sizeBytes: String(doc.sizeBytes),
          sha256: doc.sha256 || null,
          createdAt: doc.createdAt.toISOString(),
        }))
        .sort((a: any, b: any) => a.id.localeCompare(b.id)),
    });
  }

  /**
   * Generate tracking number.
   * Non-DOR format stays YYYY-DEPTCODE-NNNN for backward compatibility.
   * DOR format is DOR/OFFICE/FY/WORKFLOW/NNNN.
   */
  private async generateTrackingNumber(input: {
    deptCode: string;
    branchCode: string;
    workflowCode: string;
  }): Promise<string> {
    if (input.deptCode === 'DOR') {
      const fiscalYear = this.getNepaliFiscalYearCode(new Date());
      const workflowCode = input.workflowCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) || 'WF';
      const sequence = await this.prisma.dorTrackingSequence.upsert({
        where: {
          branchCode_workflowCode_fiscalYear: {
            branchCode: input.branchCode,
            workflowCode,
            fiscalYear,
          },
        },
        update: { lastNumber: { increment: 1 } },
        create: {
          branchCode: input.branchCode,
          workflowCode,
          fiscalYear,
          lastNumber: 1,
        },
      });

      return `DOR/${input.branchCode}/${fiscalYear}/${workflowCode}/${String(sequence.lastNumber).padStart(4, '0')}`;
    }

    const year = new Date().getFullYear();

    const sequence = await this.prisma.trackingSequence.upsert({
      where: {
        departmentCode_year: { departmentCode: input.deptCode, year },
      },
      update: { lastNumber: { increment: 1 } },
      create: { departmentCode: input.deptCode, year, lastNumber: 1 },
    });

    return `${year}-${input.deptCode}-${String(sequence.lastNumber).padStart(4, '0')}`;
  }

  private async isBranchAncestorOrSelf(userBranchId: string, submissionBranchId: string) {
    let currentBranchId: string | null = submissionBranchId;

    for (let depth = 0; currentBranchId && depth < 20; depth++) {
      if (currentBranchId === userBranchId) return true;
      const branch: { parentBranchId: string | null } | null =
        await this.prisma.branch.findUnique({
        where: { id: currentBranchId },
        select: { parentBranchId: true },
      });
      currentBranchId = branch?.parentBranchId || null;
    }

    return false;
  }

  private async getBranchAndAncestorIds(branchId: string) {
    const ids: string[] = [];
    let currentBranchId: string | null = branchId;

    for (let depth = 0; currentBranchId && depth < 20; depth++) {
      const branch: { id: string; parentBranchId: string | null } | null =
        await this.prisma.branch.findUnique({
        where: { id: currentBranchId },
        select: { id: true, parentBranchId: true },
      });
      if (!branch) break;
      ids.push(branch.id);
      currentBranchId = branch.parentBranchId;
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

  private workflowCodeFromName(name: string) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 20) || 'WF';
  }

  private normalizeWorkflowCode(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private async ensureBranchInDepartment(branchId: string, departmentId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { departmentId: true },
    });
    if (!branch) throw new NotFoundException('Target office not found');
    if (branch.departmentId !== departmentId) {
      throw new ForbiddenException('Target office must belong to the same department');
    }
  }

  private getNepaliFiscalYearCode(date: Date) {
    const fiscalYearStarts = new Date(Date.UTC(date.getUTCFullYear(), 6, 16));
    const startYear = date >= fiscalYearStarts ? date.getUTCFullYear() + 57 : date.getUTCFullYear() + 56;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  /**
   * Calculate SLA due date (adds working days, skipping weekends).
   * TODO: Integrate Bikram Sambat calendar and government holidays.
   */
  private calculateSlaDueDate(slaDays: number): Date {
    const date = new Date();
    let added = 0;
    while (added < slaDays) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      // Skip Saturday (6) — Nepal's weekly holiday
      // Friday is half-day but counted as working day
      if (day !== 6) {
        added++;
      }
    }
    return date;
  }
}
