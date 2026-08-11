import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationChannelError,
  type NotificationChannel,
  type NotificationChannelErrorKind,
} from './notification-channel.interface';

@Injectable()
export class WhaApiProvider implements NotificationChannel {
  private readonly logger = new Logger(WhaApiProvider.name);
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly channelId: string;
  private readonly timeoutMs: number;
  private readonly allowedRecipients: Set<string>;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('WHATSAPP_ENABLED', false);
    this.baseUrl = config.get<string>('WHAAPI_BASE_URL', 'https://whaapi.flobaze.com');
    this.token = config.get<string>('WHAAPI_TOKEN', '');
    this.channelId = config.get<string>('WHAAPI_CHANNEL_ID', '');
    this.timeoutMs = config.get<number>('WHATSAPP_REQUEST_TIMEOUT_MS', 10_000);
    const raw = config.get<string>('WHATSAPP_ALLOWED_RECIPIENTS', '');
    this.allowedRecipients =
      raw !== ''
        ? new Set(
            raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        : new Set();
  }

  async send(destination: string, message: string): Promise<void> {
    if (!this.enabled) {
      throw new NotificationChannelError('CONFIGURATION', 'WhatsApp notification dinonaktifkan');
    }
    if (!this.token || !this.channelId) {
      throw new NotificationChannelError('CONFIGURATION', 'Konfigurasi WhaAPI belum lengkap');
    }
    if (this.allowedRecipients.size > 0 && !this.allowedRecipients.has(destination)) {
      this.logger.debug(
        `Nomor ${this.maskPhone(destination)} tidak ada di daftar penerima — dilewati`,
      );
      return;
    }

    const phoneNumber = this.normalizePhone(destination);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          app_id: this.channelId,
          message,
          phone_number: phoneNumber,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const respBody = await response.text().catch(() => '');
        const kind = this.httpStatusToKind(response.status);
        this.logger.warn(`WhaAPI HTTP ${response.status}: ${respBody.slice(0, 500)}`);
        throw new NotificationChannelError(kind, `WhaAPI HTTP ${response.status}`);
      }

      this.logger.log(`WhaAPI terkirim ke ${this.maskPhone(phoneNumber)}`);
    } catch (error) {
      if (error instanceof NotificationChannelError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NotificationChannelError('TIMEOUT', 'WhaAPI request timeout');
      }
      throw new NotificationChannelError(
        'UNKNOWN',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.startsWith('0')) {
      normalized = '62' + normalized.slice(1);
    }
    return normalized;
  }

  private maskPhone(phone: string): string {
    const normalized = phone.replace(/[^0-9]/g, '');
    if (normalized.length <= 4) return '***';
    return `${normalized.slice(0, 4)}***${normalized.slice(-2)}`;
  }

  private httpStatusToKind(status: number): NotificationChannelErrorKind {
    if (status === 401 || status === 403) return 'UNAUTHORIZED';
    if (status === 429) return 'RATE_LIMITED';
    if (status === 400 || status === 422) return 'BAD_RECIPIENT';
    if (status >= 500) return 'UNAVAILABLE';
    return 'UNKNOWN';
  }
}
