import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type NotificationEvent = Readonly<{
  penggunaId: string | null;
  type: 'changed' | 'heartbeat';
  at: string;
}>;

@Injectable()
export class NotificationEventsService {
  private readonly subject = new Subject<NotificationEvent>();
  readonly events$ = this.subject.asObservable();

  emitChanged(penggunaId: string | null = null): void {
    this.subject.next({ penggunaId, type: 'changed', at: new Date().toISOString() });
  }

  emitHeartbeat(penggunaId: string | null = null): void {
    this.subject.next({ penggunaId, type: 'heartbeat', at: new Date().toISOString() });
  }
}
