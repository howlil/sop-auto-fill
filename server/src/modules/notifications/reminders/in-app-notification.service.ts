import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationEventsService } from './notification-events.service';
import { ReminderMessageFactory } from './reminder-message.factory';
import { NotificationReminderRepository } from './notification-reminder.repository';
import type { InAppReminderNotification } from './notification-reminder.types';

@Injectable()
export class InAppNotificationService {
  constructor(
    private readonly repository: NotificationReminderRepository,
    private readonly messageFactory: ReminderMessageFactory,
    private readonly notificationEvents: NotificationEventsService,
  ) {}

  async getSummary(penggunaId: string): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.repository.countUnreadInApp(penggunaId) };
  }

  async findMine(penggunaId: string, limit: number): Promise<InAppReminderNotification[]> {
    const rows = await this.repository.findInAppNotifications(penggunaId, this.normalizeLimit(limit));
    return rows.map((row) => {
      const message = this.messageFactory.build({
        ...row,
        consecutiveFailures: 0,
        lockToken: null,
      });
      return {
        id: row.notificationReminderId,
        pengajuanEvaluasiId: row.pengajuanEvaluasiId,
        kind: row.kind,
        title: message.title,
        preview: message.preview,
        body: message.body,
        readAt: row.inAppReadAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  async markRead(penggunaId: string, notificationId: string): Promise<{ unreadCount: number }> {
    const updated = await this.repository.markInAppRead(penggunaId, notificationId, new Date());
    if (!updated) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }
    this.notificationEvents.emitChanged(penggunaId);
    return this.getSummary(penggunaId);
  }

  async markAllRead(penggunaId: string): Promise<{ unreadCount: number; updated: number }> {
    const updated = await this.repository.markAllInAppRead(penggunaId, new Date());
    if (updated > 0) {
      this.notificationEvents.emitChanged(penggunaId);
    }
    return { unreadCount: await this.repository.countUnreadInApp(penggunaId), updated };
  }

  private normalizeLimit(limit: number): number {
    if (!Number.isFinite(limit)) {
      return 10;
    }
    return Math.min(Math.max(Math.trunc(limit), 1), 50);
  }
}
