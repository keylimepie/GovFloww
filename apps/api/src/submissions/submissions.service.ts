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
  CreateSubmissionInput,
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
    // Validate workflow exists and is active
    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { id: dto.workflowId },
      include: {
        stages: { orderBy: { stageOrder: 'asc' } },
        department: { select: { code: true } },
      },
    });

    if (!workflow) throw new NotFoundException('Workflow not found');
    if (workflow.status !== WorkflowStatus.ACTIVE) {
      throw new BadRequestException('This workflow is not active');
    }
    if (workflow.stages.length === 0) {
      throw new BadRequestException('Workflow has no stages configured');
    }

    // Validate branch exists
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    // Generate tracking number: YYYY-DEPTCODE-NNNN
    const trackingNumber = await this.generateTrackingNumber(workflow.department.code);

    const firstStage = workflow.stages[0];

    // Create submission + first file stage in a transaction
    const submission = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.fileSubmission.create({
        data: {
          trackingNumber,
          contractorId: user.sub,
          workflowId: dto.workflowId,
          workflowVersion: workflow.version,
          branchId: dto.branchId,
          status: SubmissionStatus.SUBMITTED,
          currentStageId: firstStage.id,
          title: dto.title,
          description: dto.description || null,
          metadata: dto.metadata as any,
        },
      });

      // Create first file stage
      const slaDueAt = this.calculateSlaDueDate(firstStage.slaDays);
      await tx.fileStage.create({
        data: {
          submissionId: sub.id,
          stageId: firstStage.id,
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
        workflowId: dto.workflowId,
        workflowName: workflow.name,
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
      if (user.branchId) {
        where.branchId = user.branchId;
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
        contractor: { select: { firstName: true, lastName: true, companyName: true } },
        fileStages: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            stage: { select: { name: true, assignedRole: { select: { code: true, name: true } } } },
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
            stages: { orderBy: { stageOrder: 'asc' } },
          },
        },
        branch: true,
        contractor: {
          select: { id: true, firstName: true, lastName: true, companyName: true, email: true },
        },
        fileStages: {
          orderBy: { startedAt: 'asc' },
          include: {
            stage: true,
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
    this.validateSubmissionScope(submission, user);

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
    this.validateSubmissionScope(submission, user);

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

    this.validateSubmissionScope(submission, user);

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
    this.validateSubmissionScope(submission, user);

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
    this.validateStageAccess(submission, user, StageAction.FORWARD);

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

    // Find next stage
    const nextStage = submission.workflow.stages.find(
      (s: any) => s.stageOrder === currentStage.stageOrder + 1,
    );

    // Complete current file stage
    await this.prisma.fileStage.updateMany({
      where: {
        submissionId,
        stageId: submission.currentStageId!,
        status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] },
      },
      data: {
        status: FileStageStatus.COMPLETED,
        completedAt: new Date(),
        assignedTo: user.sub,
      },
    });

    if (nextStage) {
      // Create new file stage for next stage
      const slaDueAt = this.calculateSlaDueDate(nextStage.slaDays);
      await this.prisma.fileStage.create({
        data: {
          submissionId,
          stageId: nextStage.id,
          status: FileStageStatus.PENDING,
          slaDueAt,
        },
      });

      await this.prisma.fileSubmission.update({
        where: { id: submissionId },
        data: {
          currentStageId: nextStage.id,
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

    await this.auditService.log({
      submissionId,
      actorId: user.sub,
      action: AuditAction.FILE_FORWARDED,
      metadata: {
        fromStage: currentStage.name,
        toStage: nextStage?.name || 'APPROVED',
        comment: dto.comment,
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
    this.validateStageAccess(submission, user, StageAction.REJECT);

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
        status: FileStageStatus.PENDING,
        slaDueAt,
      },
    });

    await this.prisma.fileSubmission.update({
      where: { id: submissionId },
      data: {
        currentStageId: targetStage.id,
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
    this.validateStageAccess(submission, user, StageAction.HOLD);

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
    this.validateSubmissionScope(submission, user);

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
    this.validateStageAccess(submission, user, StageAction.SIGN_TIER1);
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

    // Return sanitized public data only
    return {
      trackingNumber: submission.trackingNumber,
      title: submission.title,
      workflowName: submission.workflow.name,
      status: submission.status,
      submittedAt: submission.createdAt,
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
              include: { assignedRole: true, parallelConfig: true },
            },
          },
        },
        documents: true,
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (!submission.currentStageId) {
      throw new BadRequestException('File has already been approved or archived');
    }
    return submission;
  }

  private validateStageAccess(submission: any, user: JwtPayload, action: StageAction) {
    // Super admin can always act
    if (user.role === 'SUPER_ADMIN') return;
    this.validateSubmissionScope(submission, user);

    const currentStage = submission.workflow.stages.find(
      (s: any) => s.id === submission.currentStageId,
    );
    if (!currentStage) {
      throw new BadRequestException('Current stage configuration not found');
    }

    // Check role matches stage's assigned role
    if (currentStage.assignedRole?.code !== user.role && currentStage.assignedRoleId !== user.roleId) {
      throw new ForbiddenException(
        `This stage requires role: ${currentStage.assignedRole?.name || 'Unknown'}`,
      );
    }

    // Check action is allowed at this stage
    if (!currentStage.allowedActions.includes(action)) {
      throw new ForbiddenException(
        `Action '${action}' is not allowed at this stage`,
      );
    }
  }

  private validateSubmissionScope(submission: any, user: JwtPayload) {
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

    if (user.branchId && submission.branchId && submission.branchId !== user.branchId) {
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
   * Generate tracking number: YYYY-DEPTCODE-NNNN (zero-padded).
   * Uses atomic increment on tracking_sequences table to avoid race conditions.
   */
  private async generateTrackingNumber(deptCode: string): Promise<string> {
    const year = new Date().getFullYear();

    const sequence = await this.prisma.trackingSequence.upsert({
      where: {
        departmentCode_year: { departmentCode: deptCode, year },
      },
      update: { lastNumber: { increment: 1 } },
      create: { departmentCode: deptCode, year, lastNumber: 1 },
    });

    return `${year}-${deptCode}-${String(sequence.lastNumber).padStart(4, '0')}`;
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
