import { Injectable, Logger } from '@nestjs/common';
import { NotificationEventsService } from './notification-events.service';
import { NotificationRecipientResolverService } from './notification-recipient-resolver.service';
import { NotificationReminderRepository } from './notification-reminder.repository';
import { reminderIdentity } from './notification-reminder.types';

@Injectable()
export class NotificationReminderReconcilerService {
  private readonly logger = new Logger(NotificationReminderReconcilerService.name);

  constructor(
    private readonly repository: NotificationReminderRepository,
    private readonly recipientResolver: NotificationRecipientResolverService,
    private readonly notificationEvents: NotificationEventsService,
  ) {}

  async reconcile(now = new Date()): Promise<{ desired: number; deleted: number }> {
    const [pengajuanRows, recipients, existing] = await Promise.all([
      this.repository.findActionablePengajuan(),
      this.repository.findActiveRecipients(),
      this.repository.findExistingReminders(),
    ]);
    const desired = pengajuanRows.flatMap((pengajuan) =>
      this.recipientResolver.resolve(pengajuan, recipients),
    );
    const desiredKeys = new Set(desired.map(reminderIdentity));
    const staleIds = existing
      .filter((reminder) => !desiredKeys.has(reminderIdentity(reminder)))
      .map((reminder) => reminder.notificationReminderId);

    await Promise.all(
      desired.map((reminder) => this.repository.upsertDesiredReminder(reminder, now)),
    );
    const deleted = await this.repository.deleteReminderIds(staleIds);
    if (desired.length > 0) {
      for (const penggunaId of new Set(desired.map((reminder) => reminder.penggunaId))) {
        this.notificationEvents.emitChanged(penggunaId);
      }
    }
    if (deleted > 0) {
      this.notificationEvents.emitChanged();
    }
    if (desired.length > 0 || deleted > 0) {
      this.logger.debug(`Reconcile reminder selesai desired=${desired.length} deleted=${deleted}`);
    }
    return { desired: desired.length, deleted };
  }
}
