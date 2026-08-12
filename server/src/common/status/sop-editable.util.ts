import { ConflictException } from '@nestjs/common';
import { StatusSOP } from '../../generated/prisma';

export function isDetailSopEditable(status: StatusSOP): boolean {
  return status === StatusSOP.DRAFT;
}

export function assertDetailSopEditable(status: StatusSOP): void {
  if (!isDetailSopEditable(status)) {
    throw new ConflictException(
      status === StatusSOP.COMPLETED
        ? 'SOP yang sudah selesai tidak dapat diedit langsung. Buat versi baru untuk melakukan perubahan.'
        : 'SOP yang diarsipkan tidak dapat diedit.',
    );
  }
}
