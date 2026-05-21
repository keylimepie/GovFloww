// =============================================
// Submissions Controller
// =============================================

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmissionsService } from './submissions.service';
import { RolesGuard, PermissionsGuard } from '../common/guards';
import {
  Roles,
  RequirePermissions,
  CurrentUser,
  ClientIp,
  Public,
} from '../common/decorators';
import { ZodValidationPipe } from '../common/pipes';
import {
  Role,
  CreateSubmissionSchema,
  ForwardSubmissionSchema,
  RejectSubmissionSchema,
  HoldSubmissionSchema,
  AddCommentSchema,
  SignSubmissionSchema,
  UpdatePublicTrackingSchema,
} from '@govflow/shared';
import type {
  CreateSubmissionInput,
  ForwardSubmissionInput,
  RejectSubmissionInput,
  HoldSubmissionInput,
  AddCommentInput,
  UpdatePublicTrackingInput,
  JwtPayload,
} from '@govflow/shared';

@Controller('api/submissions')
@UseGuards(RolesGuard, PermissionsGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @RequirePermissions('submission:create')
  async create(
    @Body(new ZodValidationPipe(CreateSubmissionSchema)) dto: CreateSubmissionInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const submission = await this.submissionsService.create(dto, user, ip);
    return { success: true, data: submission };
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('workflowId') workflowId?: string,
  ) {
    const submissions = await this.submissionsService.findAll(user, {
      status,
      workflowId,
    });
    return { success: true, data: submissions };
  }

  @Get('verify/signature/:id')
  @Public()
  async verifySignature(@Param('id') id: string) {
    const data = await this.submissionsService.verifySignature(id);
    return { success: true, data };
  }

  @Get('track/:trackingNumber')
  @Public()
  async track(@Param('trackingNumber') trackingNumber: string) {
    const result = await this.submissionsService.track(trackingNumber);
    return { success: true, data: result };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const submission = await this.submissionsService.findOne(id, user);
    return { success: true, data: submission };
  }

  @Post(':id/documents')
  @RequirePermissions('submission:upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })], // 10MB limit
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.submissionsService.uploadDocument(id, file, user, ip);
    return { success: true, data };
  }

  @Get(':id/documents/:documentId/url')
  async getDocumentUrl(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.submissionsService.getDocumentUrl(id, documentId, user, ip);
    return { success: true, data };
  }

  @Post(':id/forward')
  @RequirePermissions('submission:forward')
  async forward(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ForwardSubmissionSchema)) dto: ForwardSubmissionInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const submission = await this.submissionsService.forward(id, dto, user, ip);
    return { success: true, data: submission };
  }

  @Post(':id/reject')
  @RequirePermissions('submission:reject_any', 'submission:reject_prev')
  async reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectSubmissionSchema)) dto: RejectSubmissionInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const submission = await this.submissionsService.reject(id, dto, user, ip);
    return { success: true, data: submission };
  }

  @Post(':id/hold')
  @RequirePermissions('submission:hold')
  async hold(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HoldSubmissionSchema)) dto: HoldSubmissionInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const submission = await this.submissionsService.hold(id, dto, user, ip);
    return { success: true, data: submission };
  }

  @Post(':id/sign')
  @RequirePermissions('submission:sign_t1', 'submission:sign_t2')
  async sign(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SignSubmissionSchema)) dto: { pin: string },
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const signature = await this.submissionsService.sign(id, dto.pin, user, ip);
    return { success: true, data: signature };
  }

  @Post(':id/public-tracking')
  @RequirePermissions('submission:manage_public_tracking')
  async updatePublicTracking(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePublicTrackingSchema)) dto: UpdatePublicTrackingInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const submission = await this.submissionsService.updatePublicTracking(id, dto.publicTrackable, user, ip);
    return { success: true, data: submission };
  }

  @Post(':id/comments')
  @RequirePermissions('submission:comment', 'submission:respond_query')
  async addComment(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AddCommentSchema)) dto: AddCommentInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const comment = await this.submissionsService.addComment(id, dto, user, ip);
    return { success: true, data: comment };
  }
}
