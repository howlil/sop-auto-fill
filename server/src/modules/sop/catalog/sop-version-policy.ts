import { ConflictException } from '@nestjs/common';

export type SopProjectStatus = 'DRAFT' | 'COMPLETED' | 'ARCHIVED';

export function assertCanEditCurrentVersion(status: SopProjectStatus): void {
  if (status !== 'DRAFT') {
    throw new ConflictException(
      status === 'COMPLETED'
        ? 'SOP yang sudah selesai tidak dapat diedit langsung. Buat versi baru untuk melakukan perubahan.'
        : 'SOP yang diarsipkan tidak dapat diedit.',
    );
  }
}

export function assertCanCreateNewVersion(status: SopProjectStatus): void {
  if (status !== 'COMPLETED') {
    throw new ConflictException(
      status === 'ARCHIVED'
        ? 'SOP yang diarsipkan tidak dapat dibuatkan versi baru.'
        : 'Versi baru hanya dapat dibuat setelah versi aktif diselesaikan.',
    );
  }
}
