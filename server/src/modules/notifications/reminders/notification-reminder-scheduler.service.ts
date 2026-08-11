import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PushReminderWorkerService } from './push-reminder-worker.service';
import { NotificationReminderReconcilerService } from './notification-reminder-reconciler.service';

const SCHEDULER_NAME = 'notification-reminder-reconcile';

@Injectable()
export class NotificationReminderSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationReminderSchedulerService.name);
  private readonly inAppEnabled: boolean;
  private readonly whatsappEnabled: boolean;
  private readonly intervalMs: number;
  private running = false;

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly reconciler: NotificationReminderReconcilerService,
    private readonly pushWorker: PushReminderWorkerService,
    config: ConfigService,
  ) {
    this.inAppEnabled = config.get<boolean>('NOTIFICATION_IN_APP_ENABLED', true);
    this.whatsappEnabled = config.get<boolean>('WHATSAPP_ENABLED', false);
    this.intervalMs = config.get<number>('NOTIFICATION_RECONCILE_INTERVAL_SECONDS', 10) * 1_000;
  }

  onModuleInit(): void {
    if (!this.inAppEnabled && !this.whatsappEnabled) {
      this.logger.log('Notification reminder dinonaktifkan untuk seluruh channel');
      return;
    }

    const interval = setInterval(() => void this.tick(), this.intervalMs);
    this.schedulerRegistry.addInterval(SCHEDULER_NAME, interval);
    this.logger.log(
      `Notification reminder aktif interval=${this.intervalMs}ms ` +
        `inApp=${this.inAppEnabled} whatsapp=${this.whatsappEnabled}`,
    );
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', SCHEDULER_NAME)) {
      this.schedulerRegistry.deleteInterval(SCHEDULER_NAME);
    }
  }

  async tick(): Promise<void> {
    if ((!this.inAppEnabled && !this.whatsappEnabled) || this.running) {
      return;
    }
    this.running = true;
    try {
      await this.reconciler.reconcile();
      if (this.whatsappEnabled) {
        await this.pushWorker.processDue();
      }
    } catch (error) {
      this.logger.error(
        `Siklus notification reminder gagal: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
