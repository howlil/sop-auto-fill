import {
  JenisPengingatWhatsApp as NotificationReminderKind,
  PeranPengguna,
  StatusPengajuanEvaluasi,
} from '../../../generated/prisma';

export type ActionablePengajuan = Readonly<{
  pengajuanEvaluasiId: string;
  opdId: string;
  opdNama: string;
  nomorBA: string | null;
  status: StatusPengajuanEvaluasi;
  jumlahSop: number;
}>;

export type ActiveNotificationRecipient = Readonly<{
  penggunaId: string;
  opdId: string;
  email: string;
  nama: string;
  peran: PeranPengguna;
  nohp: string;
}>;

export type DesiredNotificationReminder = Readonly<{
  pengajuanEvaluasiId: string;
  penggunaId: string;
  kind: NotificationReminderKind;
  destination: string;
}>;

export type ClaimedNotificationReminder = Readonly<{
  notificationReminderId: string;
  pengajuanEvaluasiId: string;
  penggunaId: string;
  kind: NotificationReminderKind;
  destination: string;
  consecutiveFailures: number;
  lockToken: string | null;
  pengajuanEvaluasi: ActionablePengajuan;
  pengguna: ActiveNotificationRecipient & { deletedAt: Date | null };
}>;

export type InAppReminderNotification = Readonly<{
  id: string;
  pengajuanEvaluasiId: string;
  kind: NotificationReminderKind;
  title: string;
  preview: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export const ACTIONABLE_REMINDER_STATUSES: readonly StatusPengajuanEvaluasi[] = [
  StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
  StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
] as const;

export const REMINDER_KIND_BY_STATUS: Readonly<
  Partial<Record<StatusPengajuanEvaluasi, NotificationReminderKind>>
> = {
  [StatusPengajuanEvaluasi.SEDANG_DIEVALUASI]: NotificationReminderKind.EVALUASI_SOP,
  [StatusPengajuanEvaluasi.SELESAI_DIEVALUASI]: NotificationReminderKind.TTD_BA_PJ_EVALUATOR,
  [StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR]: NotificationReminderKind.TTD_BA_PJ_PENYUSUN,
  [StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN]: NotificationReminderKind.TTD_SOP_KEPALA_OPD,
};

export const EXPECTED_STATUS_BY_REMINDER_KIND: Readonly<
  Record<NotificationReminderKind, StatusPengajuanEvaluasi>
> = {
  [NotificationReminderKind.EVALUASI_SOP]: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
  [NotificationReminderKind.TTD_BA_PJ_EVALUATOR]: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
  [NotificationReminderKind.TTD_BA_PJ_PENYUSUN]: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
  [NotificationReminderKind.TTD_SOP_KEPALA_OPD]: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
};

export const EXPECTED_ROLE_BY_REMINDER_KIND: Readonly<
  Record<NotificationReminderKind, PeranPengguna>
> = {
  [NotificationReminderKind.EVALUASI_SOP]: PeranPengguna.EVALUATOR,
  [NotificationReminderKind.TTD_BA_PJ_EVALUATOR]: PeranPengguna.PJ_EVALUATOR,
  [NotificationReminderKind.TTD_BA_PJ_PENYUSUN]: PeranPengguna.PJ_PENYUSUN,
  [NotificationReminderKind.TTD_SOP_KEPALA_OPD]: PeranPengguna.KEPALA_OPD,
};

export function reminderIdentity(reminder: {
  pengajuanEvaluasiId: string;
  penggunaId: string;
  kind: NotificationReminderKind;
}): string {
  return `${reminder.pengajuanEvaluasiId}:${reminder.penggunaId}:${String(reminder.kind)}`;
}
