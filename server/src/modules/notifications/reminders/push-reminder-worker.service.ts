import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { isReminderStillEligible } from './reminder-eligibility.util';
import { ReminderMessageFactory } from './reminder-message.factory';
import { NotificationReminderRepository } from './notification-reminder.repository';
import {
  NOTIFICATION_CHANNEL,
  NotificationChannelError,
  type NotificationChannel,
} from './providers/notification-channel.interface';

const TRANSIENT_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000] as const;
const CONFIGURATION_RETRY_MS = 5 * 60_000;

@Injectable()
export class PushReminderWorkerService {
  private readonly logger = new Logger(PushReminderWorkerService.name);
  private readonly maxConcurrency: number;
  private readonly leaseMs: number;
  private readonly reminderIntervalMs: number;

  constructor(
    private readonly repository: NotificationReminderRepository,
    private readonly messageFactory: ReminderMessageFactory,
    config: ConfigService,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
  ) {
    this.maxConcurrency = config.get<number>('WHATSAPP_MAX_CONCURRENCY', 3);
    this.leaseMs = config.get<number>('WHATSAPP_LOCK_LEASE_SECONDS', 60) * 1_000;
    this.reminderIntervalMs =
      config.get<number>('WHATSAPP_REMINDER_INTERVAL_MINUTES', 1) * 60_000;
  }

  async processDue(now = new Date()): Promise<{ candidates: number; processed: number }> {
    const candidateIds = await this.repository.findDueCandidateIds(
      now,
      Math.max(this.maxConcurrency * 4, this.maxConcurrency),
    );
    if (candidateIds.length === 0) {
      return { candidates: 0, processed: 0 };
    }

    let processed = 0;
    for (let offset = 0; offset < candidateIds.length; offset += this.maxConcurrency) {
      const batch = candidateIds.slice(offset, offset + this.maxConcurrency);
      const results = await Promise.all(
        batch.map((id) =>
          this.processOne(id, now).catch((error) => {
            this.logger.error(
              `Push reminder gagal tak terduga id=${id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return false;
          }),
        ),
      );
      processed += results.filter(Boolean).length;
    }
    return { candidates: candidateIds.length, processed };
  }

  private async processOne(notificationReminderId: string, now: Date): Promise<boolean> {
    const lockToken = randomUUID();
    const claimed = await this.repository.tryClaim(
      notificationReminderId,
      lockToken,
      now,
      new Date(now.getTime() + this.leaseMs),
    );
    if (!claimed) return false;

    const reminder = await this.repository.findClaimed(notificationReminderId, lockToken);
    if (reminder === null) return false;

    if (!isReminderStillEligible(reminder)) {
      await this.repository.releaseClaim(notificationReminderId, lockToken);
      return true;
    }

    try {
      const message = this.messageFactory.build(reminder);
      await this.channel.send(reminder.destination, message.body);
      const sentAt = new Date();
      await this.repository.markSuccess(
        notificationReminderId,
        lockToken,
        sentAt,
        new Date(sentAt.getTime() + this.reminderIntervalMs),
      );
      this.logger.log(
        `Push reminder terkirim id=${notificationReminderId} kind=${String(reminder.kind)} ` +
          `tujuan=${this.maskDestination(reminder.destination)}`,
      );
      return true;
    } catch (error) {
      const channelError = this.normalizeError(error);
      const nextSendAt = this.nextAttemptAt(channelError, reminder.consecutiveFailures, now);
      await this.repository.markFailure(
        notificationReminderId,
        lockToken,
        nextSendAt,
        channelError.kind,
      );
      this.logger.warn(
        `Push reminder gagal id=${notificationReminderId} kind=${String(reminder.kind)} ` +
          `tujuan=${this.maskDestination(reminder.destination)} error=${channelError.kind} ` +
          `retryAt=${nextSendAt.toISOString()}`,
      );
      return true;
    }
  }

  private normalizeError(error: unknown): NotificationChannelError {
    if (error instanceof NotificationChannelError) return error;
    return new NotificationChannelError(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Kegagalan channel tidak diketahui',
    );
  }

  private nextAttemptAt(
    error: NotificationChannelError,
    failures: number,
    now: Date,
  ): Date {
    if (error.kind === 'BAD_RECIPIENT') {
      return new Date(now.getTime() + this.reminderIntervalMs);
    }
    if (error.retryAfterMs !== undefined) {
      return new Date(now.getTime() + error.retryAfterMs);
    }
    if (error.kind === 'UNAUTHORIZED' || error.kind === 'CONFIGURATION') {
      return new Date(now.getTime() + CONFIGURATION_RETRY_MS);
    }
    const index = Math.min(failures, TRANSIENT_BACKOFF_MS.length - 1);
    return new Date(now.getTime() + TRANSIENT_BACKOFF_MS[index]);
  }

  private maskDestination(destination: string): string {
    if (destination.length <= 4) return '***';
    return `${destination.slice(0, 2)}***${destination.slice(-2)}`;
  }
}
