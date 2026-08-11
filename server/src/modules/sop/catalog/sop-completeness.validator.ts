import { BadRequestException } from '@nestjs/common';
import { JenisLangkahProsedur } from '../../../generated/prisma';
import type { SopWorkbenchDbPayload } from './sop-catalog.repository';

/**
 * Mengumpulkan pesan validasi kelengkapan area kerja untuk status Siap Dievaluasi.
 * Tanggal revisi dan tanggal efektif tidak diwajibkan.
 */
export function collectSopWorkbenchCompletenessIssues(row: SopWorkbenchDbPayload): string[] {
  const pesan: string[] = [];
  if (row.sop.judul.trim() === '') {
    pesan.push('Judul SOP wajib diisi');
  }
  if (row.nomorSOP.trim() === '') {
    pesan.push('Nomor SOP wajib diisi');
  }
  if (row.namaLembaga.trim() === '') {
    pesan.push('Nama lembaga wajib diisi');
  }
  if (row.dasarHukum.length === 0) {
    pesan.push('Minimal satu dasar hukum wajib dipilih');
  }
  if (row.relasiSopKeluar.length === 0) {
    pesan.push('Minimal satu SOP terkait wajib dipilih');
  }
  const assertMinimalTeks = (items: ReadonlyArray<{ teks: string }>, label: string): void => {
    const adaIsi = items.some((r) => r.teks.trim().length > 0);
    if (!adaIsi) {
      pesan.push(`${label} wajib berisi minimal satu isian`);
    }
  };
  assertMinimalTeks(row.lampiranPeringatan, 'Peringatan');
  assertMinimalTeks(row.lampiranKualifikasiPelaksanaan, 'Kualifikasi pelaksanaan');
  assertMinimalTeks(row.lampiranPeralatanPerlengkapan, 'Peralatan dan perlengkapan');
  assertMinimalTeks(row.lampiranPencatatanPendataan, 'Pencatatan dan pendataan');
  if (row.swimlanes.length === 0) {
    pesan.push('Minimal satu kolom pelaksana wajib ada');
  }
  if (row.langkahSOP.length === 0) {
    pesan.push('Minimal satu langkah prosedur wajib ada');
  }
  const langkahUrut = [...row.langkahSOP].sort((a, b) => a.urutan - b.urutan);
  for (const step of langkahUrut) {
    const prefix = `Langkah urutan ${step.urutan}`;
    if (step.kegiatan.trim() === '') {
      pesan.push(`${prefix}: kegiatan wajib diisi`);
    }
    if (step.kelengkapan.trim() === '') {
      pesan.push(`${prefix}: kelengkapan wajib diisi`);
    }
    if (step.keluaran.trim() === '') {
      pesan.push(`${prefix}: keluaran wajib diisi`);
    }
    if (step.keterangan.trim() === '') {
      pesan.push(`${prefix}: keterangan wajib diisi`);
    }
    if (step.pelaksanaId.trim() === '') {
      pesan.push(`${prefix}: pelaksana wajib dipilih`);
    }
    if (step.jenis === JenisLangkahProsedur.KEPUTUSAN) {
      if (
        step.langkahSelanjutnyaYaId === null ||
        step.langkahSelanjutnyaYaId === undefined ||
        step.langkahSelanjutnyaYaId.trim() === ''
      ) {
        pesan.push(`${prefix}: cabang "Ya" wajib menunjuk langkah berikutnya`);
      }
      if (
        step.langkahSelanjutnyaTidakId === null ||
        step.langkahSelanjutnyaTidakId === undefined ||
        step.langkahSelanjutnyaTidakId.trim() === ''
      ) {
        pesan.push(`${prefix}: cabang "Tidak" wajib menunjuk langkah berikutnya`);
      }
    }
  }
  return pesan;
}

export function assertSopWorkbenchCompleteForSiapDievaluasi(row: SopWorkbenchDbPayload): void {
  const pesan = collectSopWorkbenchCompletenessIssues(row);
  if (pesan.length > 0) {
    throw new BadRequestException(
      `SOP belum lengkap untuk status Siap Dievaluasi. ${pesan.join(' ')}`,
    );
  }
}
