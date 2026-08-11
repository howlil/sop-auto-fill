import { BadRequestException } from '@nestjs/common';
import { StatusTindakLanjut } from '../../../generated/prisma';
import type { NilaiRevisiAktifRow } from './evaluasi-nilai.repository';

/** Validasi guard kirim ulang: umpan balik aktif boleh dikirim ulang meski tindak lanjut masih TERBUKA. */
export function assertBolehKirimUlangSetelahRevisi(nilai: NilaiRevisiAktifRow | null): void {
  if (nilai === null) {
    return;
  }
  if (
    nilai.statusTindakLanjut !== StatusTindakLanjut.TERBUKA &&
    nilai.statusTindakLanjut !== StatusTindakLanjut.SELESAI
  ) {
    throw new BadRequestException(
      'Tidak ada umpan balik evaluasi yang dapat dikirim ulang ke evaluator',
    );
  }
}
