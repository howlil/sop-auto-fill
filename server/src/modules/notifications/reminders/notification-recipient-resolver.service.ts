import { Injectable, Logger } from '@nestjs/common';
import { PeranPengguna, StatusPengajuanEvaluasi } from '../../../generated/prisma';
import type {
  ActionablePengajuan,
  ActiveNotificationRecipient,
  DesiredNotificationReminder,
} from './notification-reminder.types';
import { REMINDER_KIND_BY_STATUS } from './notification-reminder.types';

@Injectable()
export class NotificationRecipientResolverService {
  private readonly logger = new Logger(NotificationRecipientResolverService.name);
  private readonly loggedIssues = new Set<string>();

  resolve(
    pengajuan: ActionablePengajuan,
    recipients: readonly ActiveNotificationRecipient[],
  ): DesiredNotificationReminder[] {
    const kind = REMINDER_KIND_BY_STATUS[pengajuan.status];
    if (kind === undefined) {
      return [];
    }
    const selected = this.selectRecipients(pengajuan, recipients);
    const desired: DesiredNotificationReminder[] = [];
    const seenUsers = new Set<string>();

    for (const recipient of selected) {
      if (seenUsers.has(recipient.penggunaId)) {
        continue;
      }
      seenUsers.add(recipient.penggunaId);
      desired.push({
        pengajuanEvaluasiId: pengajuan.pengajuanEvaluasiId,
        penggunaId: recipient.penggunaId,
        kind: kind,
        destination: recipient.nohp,
      });
    }
    return desired;
  }

  private selectRecipients(
    pengajuan: ActionablePengajuan,
    recipients: readonly ActiveNotificationRecipient[],
  ): ActiveNotificationRecipient[] {
    switch (pengajuan.status) {
      case StatusPengajuanEvaluasi.SEDANG_DIEVALUASI:
        return recipients.filter((recipient) => recipient.peran === PeranPengguna.EVALUATOR);
      case StatusPengajuanEvaluasi.SELESAI_DIEVALUASI:
        return this.requireSingleton(
          pengajuan,
          recipients.filter((recipient) => recipient.peran === PeranPengguna.PJ_EVALUATOR),
          'PJ_EVALUATOR',
        );
      case StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR:
        return this.requireSingleton(
          pengajuan,
          recipients.filter(
            (recipient) =>
              recipient.peran === PeranPengguna.PJ_PENYUSUN && recipient.opdId === pengajuan.opdId,
          ),
          'PJ_PENYUSUN',
        );
      case StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN:
        return this.requireSingleton(
          pengajuan,
          recipients.filter(
            (recipient) =>
              recipient.peran === PeranPengguna.KEPALA_OPD && recipient.opdId === pengajuan.opdId,
          ),
          'KEPALA_OPD',
        );
      default:
        return [];
    }
  }

  private requireSingleton(
    pengajuan: ActionablePengajuan,
    recipients: ActiveNotificationRecipient[],
    role: string,
  ): ActiveNotificationRecipient[] {
    if (recipients.length === 1) {
      return recipients;
    }
    this.errorOnce(
      `singleton:${pengajuan.pengajuanEvaluasiId}:${String(pengajuan.status)}:${role}:${recipients.length}`,
      `Invariant penerima ${role} tidak terpenuhi pengajuan=${pengajuan.pengajuanEvaluasiId} ` +
        `opd=${pengajuan.opdId} jumlah=${recipients.length}; reminder tidak dibuat`,
    );
    return [];
  }

  private errorOnce(key: string, message: string): void {
    if (!this.loggedIssues.has(key)) {
      this.loggedIssues.add(key);
      this.logger.error(message);
    }
  }
}
