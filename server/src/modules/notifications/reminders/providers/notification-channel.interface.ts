export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');

export type NotificationChannelErrorKind =
  | 'CONFIGURATION'
  | 'BAD_RECIPIENT'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNAUTHORIZED'
  | 'UNAVAILABLE'
  | 'UNKNOWN';

export class NotificationChannelError extends Error {
  constructor(
    readonly kind: NotificationChannelErrorKind,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'NotificationChannelError';
  }
}

export interface NotificationChannel {
  /** Kirim pesan ke tujuan (nomor HP, device token, dsb). */
  send(destination: string, message: string): Promise<void>;
}
