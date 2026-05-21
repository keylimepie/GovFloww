// =============================================
// Audit Controller — Read-Only Access to Audit Logs
// =============================================

import { Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RolesGuard } from '../common/guards';
import { Roles } from '../common/decorators';
import { Role } from '@govflow/shared';

@Controller('api/audit')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Get audit trail for a specific submission */
  @Get('submission/:submissionId')
  @Roles(Role.SUPER_ADMIN, Role.DEPARTMENT_ADMIN, Role.BRANCH_ADMIN)
  async getSubmissionAudit(@Param('submissionId') submissionId: string) {
    const trail = await this.auditService.getSubmissionAuditTrail(submissionId);
    return { success: true, data: trail };
  }

  @Get('submission/:submissionId.csv')
  @Roles(Role.SUPER_ADMIN, Role.DEPARTMENT_ADMIN, Role.BRANCH_ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="govflow-audit-trail.csv"')
  async getSubmissionAuditCsv(@Param('submissionId') submissionId: string) {
    const trail = await this.auditService.getSubmissionAuditTrail(submissionId);
    return this.auditService.toCsv(trail);
  }

  /** Verify the integrity of the entire audit chain */
  @Get('verify')
  @Roles(Role.SUPER_ADMIN, Role.IT_ADMIN)
  async verifyChain() {
    const result = await this.auditService.verifyChain();
    return { success: true, data: result };
  }
}
