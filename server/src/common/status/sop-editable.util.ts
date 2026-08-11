import { ConflictException } from '@nestjs/common';
import { StatusSOP } from '../../generated/prisma';

const EDITABLE_STATUSES: ReadonlySet<StatusSOP> = new Set([
  StatusSOP.DRAFT,
  StatusSOP.SEDANG_DISUSUN,
  StatusSOP.REVISI_DARI_EVALUATOR,
]);

/** Status terminal — versi tidak boleh diedit isi dokumen. */
export const TERMINAL_DETAIL_STATUSES: ReadonlySet<StatusSOP> = new Set([
  StatusSOP.DITOLAK_EVALUATOR,
  StatusSOP.BERLAKU,
  StatusSOP.DIGANTIKAN,
  StatusSOP.DICABUT,
]);

export function isDetailSopEditable(status: StatusSOP): boolean {
  return EDITABLE_STATUSES.has(status);
}

export function assertDetailSopEditable(status: StatusSOP): void {
  if (!isDetailSopEditable(status)) {
    throw new ConflictException(
      `DetailSOP berstatus ${String(status)} tidak dapat diubah. Hanya DRAFT, SEDANG_DISUSUN, atau REVISI_DARI_EVALUATOR yang dapat diedit.`,
    );
  }
}

export function hasRevisiInFlight(statuses: StatusSOP[]): boolean {
  return statuses.some((s) => !TERMINAL_DETAIL_STATUSES.has(s));
}
