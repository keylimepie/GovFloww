import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  CompleteTokAssignmentSchema,
  CreateRayeRequestSchema,
  CreateTokAssignmentSchema,
  PrepareTippaniSchema,
  RespondRayeRequestSchema,
} from '@govflow/shared';
import type {
  CompleteTokAssignmentInput,
  CreateRayeRequestInput,
  CreateTokAssignmentInput,
  JwtPayload,
  PrepareTippaniInput,
  RespondRayeRequestInput,
} from '@govflow/shared';
import { ClientIp, CurrentUser, RequirePermissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards';
import { ZodValidationPipe } from '../common/pipes';
import { DorService } from './dor.service';

@Controller('api/dor')
@UseGuards(PermissionsGuard)
export class DorController {
  constructor(private readonly dorService: DorService) {}

  @Get('branches')
  @RequirePermissions('*', 'org:manage_branches', 'user:view_branch', 'submission:view_assigned')
  async getBranchHierarchy(@CurrentUser() user: JwtPayload) {
    const data = await this.dorService.getBranchHierarchy(user);
    return { success: true, data };
  }

  @Get('users')
  @RequirePermissions('*', 'submission:tok_assign', 'submission:raye_request')
  async listActionUsers(@CurrentUser() user: JwtPayload) {
    const data = await this.dorService.listActionUsers(user);
    return { success: true, data };
  }

  @Get('tok/inbox')
  async myTokInbox(@CurrentUser() user: JwtPayload) {
    const data = await this.dorService.myTokInbox(user);
    return { success: true, data };
  }

  @Get('submissions/:submissionId/tok')
  async listSubmissionTok(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.dorService.listTokForSubmission(submissionId, user);
    return { success: true, data };
  }

  @Post('submissions/:submissionId/tok')
  @RequirePermissions('submission:tok_assign')
  async createTok(
    @Param('submissionId') submissionId: string,
    @Body(new ZodValidationPipe(CreateTokAssignmentSchema)) dto: CreateTokAssignmentInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.dorService.createTok(submissionId, dto, user, ip);
    return { success: true, data };
  }

  @Post('tok/:tokId/complete')
  async completeTok(
    @Param('tokId') tokId: string,
    @Body(new ZodValidationPipe(CompleteTokAssignmentSchema)) dto: CompleteTokAssignmentInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.dorService.completeTok(tokId, dto, user, ip);
    return { success: true, data };
  }

  @Post('tok/:tokId/recall')
  async recallTok(
    @Param('tokId') tokId: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.dorService.recallTok(tokId, user, ip);
    return { success: true, data };
  }

  @Get('raye/inbox')
  async myRayeInbox(@CurrentUser() user: JwtPayload) {
    const data = await this.dorService.myRayeInbox(user);
    return { success: true, data };
  }

  @Get('submissions/:submissionId/raye')
  async listSubmissionRaye(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.dorService.listRayeForSubmission(submissionId, user);
    return { success: true, data };
  }

  @Post('submissions/:submissionId/raye')
  @RequirePermissions('submission:raye_request')
  async createRaye(
    @Param('submissionId') submissionId: string,
    @Body(new ZodValidationPipe(CreateRayeRequestSchema)) dto: CreateRayeRequestInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.dorService.createRaye(submissionId, dto, user, ip);
    return { success: true, data };
  }

  @Post('raye/:rayeId/respond')
  @RequirePermissions('submission:raye_respond')
  async respondRaye(
    @Param('rayeId') rayeId: string,
    @Body(new ZodValidationPipe(RespondRayeRequestSchema)) dto: RespondRayeRequestInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.dorService.respondRaye(rayeId, dto, user, ip);
    return { success: true, data };
  }

  @Post('raye/:rayeId/cancel')
  async cancelRaye(
    @Param('rayeId') rayeId: string,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.dorService.cancelRaye(rayeId, user, ip);
    return { success: true, data };
  }

  @Get('submissions/:submissionId/tippani')
  async listTippani(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.dorService.listTippani(submissionId, user);
    return { success: true, data };
  }

  @Post('submissions/:submissionId/tippani')
  @RequirePermissions('submission:tippani_prepare')
  async prepareTippani(
    @Param('submissionId') submissionId: string,
    @Body(new ZodValidationPipe(PrepareTippaniSchema)) dto: PrepareTippaniInput,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    const data = await this.dorService.prepareTippani(submissionId, dto, user, ip);
    return { success: true, data };
  }
}
