import {
  Controller,
  DefaultValuePipe,
  Get,
  MessageEvent,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { filter, interval, map, merge, Observable, of } from 'rxjs';
import { type ApiSuccessResponse, Roles, UseJwtAndRolesGuards } from '../../../common';
import { PeranPengguna } from '../../../generated/prisma';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  type JwtAccessPayload,
} from '../../core/auth/helpers/auth.shared';
import { InAppNotificationService } from './in-app-notification.service';
import { NotificationEventsService } from './notification-events.service';
import type { InAppReminderNotification } from './notification-reminder.types';

const ALL_AUTHENTICATED_ROLES = [
  PeranPengguna.PJ_EVALUATOR,
  PeranPengguna.EVALUATOR,
  PeranPengguna.PENYUSUN,
  PeranPengguna.PJ_PENYUSUN,
  PeranPengguna.KEPALA_OPD,
] as const;

@ApiTags('Notifications')
@Controller('notifications')
@UseJwtAndRolesGuards()
export class InAppNotificationController {
  constructor(
    private readonly service: InAppNotificationService,
    private readonly notificationEvents: NotificationEventsService,
  ) {}

  @Get()
  @Roles(...ALL_AUTHENTICATED_ROLES)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Daftar notifikasi in-app milik sesi saat ini' })
  @ApiResponse({ status: 200 })
  async findMine(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<ApiSuccessResponse<InAppReminderNotification[]>> {
    const data = await this.service.findMine(req.user.sub, limit);
    return {
      message: 'Daftar notifikasi berhasil diambil',
      success: true,
      data,
    };
  }

  @Get('summary')
  @Roles(...ALL_AUTHENTICATED_ROLES)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Ringkasan unread notification sesi saat ini' })
  async summary(
    @Req() req: Request & { user: JwtAccessPayload },
  ): Promise<ApiSuccessResponse<{ unreadCount: number }>> {
    return {
      message: 'Ringkasan notifikasi berhasil diambil',
      success: true,
      data: await this.service.getSummary(req.user.sub),
    };
  }

  @Sse('stream')
  @Roles(...ALL_AUTHENTICATED_ROLES)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Stream perubahan notifikasi via Server-Sent Events' })
  stream(@Req() req: Request & { user: JwtAccessPayload }): Observable<MessageEvent> {
    const penggunaId = req.user.sub;
    const changed$ = this.notificationEvents.events$.pipe(
      filter((event) => event.penggunaId === null || event.penggunaId === penggunaId),
      map((event) => ({
        type: event.type === 'heartbeat' ? 'notifications.heartbeat' : 'notifications.changed',
        data: event,
      })),
    );
    const initial$ = of({
      type: 'notifications.changed',
      data: { penggunaId, type: 'changed', at: new Date().toISOString() },
    });
    const heartbeat$ = interval(30_000).pipe(
      map(() => ({
        type: 'notifications.heartbeat',
        data: { penggunaId, type: 'heartbeat', at: new Date().toISOString() },
      })),
    );
    return merge(initial$, changed$, heartbeat$);
  }

  @Post(':notificationId/read')
  @Roles(...ALL_AUTHENTICATED_ROLES)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Tandai satu notifikasi sebagai dibaca' })
  async markRead(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<ApiSuccessResponse<{ unreadCount: number }>> {
    return {
      message: 'Notifikasi berhasil ditandai dibaca',
      success: true,
      data: await this.service.markRead(req.user.sub, notificationId),
    };
  }

  @Post('read-all')
  @Roles(...ALL_AUTHENTICATED_ROLES)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Tandai semua notifikasi sebagai dibaca' })
  async markAllRead(
    @Req() req: Request & { user: JwtAccessPayload },
  ): Promise<ApiSuccessResponse<{ unreadCount: number; updated: number }>> {
    return {
      message: 'Semua notifikasi berhasil ditandai dibaca',
      success: true,
      data: await this.service.markAllRead(req.user.sub),
    };
  }
}
