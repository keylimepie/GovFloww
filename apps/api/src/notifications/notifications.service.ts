import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async dispatch(recipientId: string, type: string, title: string, message: string, payload?: any) {
    await this.notificationsQueue.add('send', {
      recipientId,
      type,
      title,
      message,
      payload,
    });
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { readAt: new Date() },
    });
  }
}
