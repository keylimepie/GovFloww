import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators';
import { JwtPayload } from '@govflow/shared';
import { RolesGuard, PermissionsGuard } from '../common/guards';

@Controller('api/notifications')
@UseGuards(RolesGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(@CurrentUser() user: JwtPayload) {
    const data = await this.notificationsService.getUserNotifications(user.sub);
    return { success: true, data };
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.notificationsService.markAsRead(id, user.sub);
    return { success: true, message: 'Marked as read' };
  }
}
