import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PushReminderWorkerService } from './push-reminder-worker.service';
import { InAppNotificationController } from './in-app-notification.controller';
import { InAppNotificationService } from './in-app-notification.service';
import { NotificationEventsService } from './notification-events.service';
import { ReminderMessageFactory } from './reminder-message.factory';
import { NotificationRecipientResolverService } from './notification-recipient-resolver.service';
import { NotificationReminderReconcilerService } from './notification-reminder-reconciler.service';
import { NotificationReminderRepository } from './notification-reminder.repository';
import { NotificationReminderSchedulerService } from './notification-reminder-scheduler.service';
import { NOTIFICATION_CHANNEL } from './providers/notification-channel.interface';
import { WhaApiProvider } from './providers/whaapi.provider';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [InAppNotificationController],
  providers: [
    NotificationEventsService,
    ReminderMessageFactory,
    NotificationRecipientResolverService,
    NotificationReminderRepository,
    NotificationReminderReconcilerService,
    PushReminderWorkerService,
    InAppNotificationService,
    NotificationReminderSchedulerService,
    WhaApiProvider,
    { provide: NOTIFICATION_CHANNEL, useExisting: WhaApiProvider },
  ],
})
export class NotificationModule {}
