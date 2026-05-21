import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Job } from 'bullmq';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { recipientId, type, title, message, payload } = job.data;
    this.logger.log(`Processing notification for user ${recipientId}: ${title}`);

    await this.prisma.notification.create({
      data: {
        recipientId,
        type,
        title,
        message,
        payload,
      },
    });
  }
}
