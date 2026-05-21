import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FileStageStatus } from '@govflow/shared';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkSlaBreaches() {
    this.logger.log('Running SLA Monitor Cron Job...');
    
    const now = new Date();

    const pendingStages = await this.prisma.fileStage.findMany({
      where: {
        status: { in: [FileStageStatus.PENDING, FileStageStatus.IN_PROGRESS] },
        slaDueAt: { lt: now },
      },
      include: {
        submission: true,
      },
    });

    for (const stage of pendingStages) {
      const existingAlert = await this.prisma.slaAlert.findFirst({
        where: { fileStageId: stage.id, alertType: 'BREACH' },
      });

      if (!existingAlert) {
        this.logger.warn(`SLA Breach detected for File Stage ${stage.id}`);
        
        await this.prisma.slaAlert.create({
          data: {
            fileStageId: stage.id,
            alertType: 'BREACH',
          },
        });

        if (stage.assignedTo) {
          await this.notificationsService.dispatch(
            stage.assignedTo,
            'SLA_BREACH',
            'SLA Breach Alert',
            `File ${stage.submission.trackingNumber} has breached its SLA.`,
            { fileStageId: stage.id, submissionId: stage.submissionId }
          );
        }
      }
    }
  }
}
