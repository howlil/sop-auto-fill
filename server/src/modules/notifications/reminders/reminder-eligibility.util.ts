import { PeranPengguna } from '../../../generated/prisma';
import {
  EXPECTED_ROLE_BY_REMINDER_KIND,
  EXPECTED_STATUS_BY_REMINDER_KIND,
  type ClaimedNotificationReminder,
} from './notification-reminder.types';

export function isReminderStillEligible(reminder: ClaimedNotificationReminder): boolean {
  if (
    reminder.pengajuanEvaluasi.status !== EXPECTED_STATUS_BY_REMINDER_KIND[reminder.kind] ||
    reminder.pengguna.deletedAt !== null ||
    reminder.pengguna.peran !== EXPECTED_ROLE_BY_REMINDER_KIND[reminder.kind]
  ) {
    return false;
  }
  if (
    reminder.pengguna.peran === PeranPengguna.PJ_PENYUSUN ||
    reminder.pengguna.peran === PeranPengguna.KEPALA_OPD
  ) {
    return reminder.pengguna.opdId === reminder.pengajuanEvaluasi.opdId;
  }
  return true;
}
