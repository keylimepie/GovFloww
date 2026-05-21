import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PermissionsGuard } from '../common/guards';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { JwtPayload } from '@govflow/shared';

@Controller('api/reports')
@UseGuards(PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('operational-summary')
  @RequirePermissions('report:dept', 'report:branch', 'report:export')
  async operationalSummary(@CurrentUser() user: JwtPayload) {
    const report = await this.reportsService.getOperationalSummary(user);
    return { success: true, data: report };
  }

  @Get('operational-summary.csv')
  @RequirePermissions('report:dept', 'report:branch', 'report:export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="govflow-operational-summary.csv"')
  async operationalSummaryCsv(@CurrentUser() user: JwtPayload) {
    const report = await this.reportsService.getOperationalSummary(user);
    return this.reportsService.toOperationalSummaryCsv(report);
  }
}
