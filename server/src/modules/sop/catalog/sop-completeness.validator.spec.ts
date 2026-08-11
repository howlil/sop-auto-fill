import { BadRequestException } from '@nestjs/common';
import { JenisLangkahProsedur } from '../../../generated/prisma';
import type { SopWorkbenchDbPayload } from './sop-catalog.repository';
import {
  assertSopWorkbenchCompleteForSiapDievaluasi,
  collectSopWorkbenchCompletenessIssues,
} from './sop-completeness.validator';

function buildMinimalWorkbench(
  overrides: Partial<SopWorkbenchDbPayload> = {},
): SopWorkbenchDbPayload {
  const t = new Date('2026-03-01T08:00:00.000Z');
  return {
    detailSopId: 'det-1',
    sopId: 'sop-1',
    status: 'DRAFT',
    versi: 1,
    nomorSOP: '001',
    namaLembaga: 'Lembaga',
    sop: { sopId: 'sop-1', opdId: 'opd-1', judul: 'Judul', createdAt: t, updatedAt: t },
    dasarHukum: [
      {
        peraturanId: 'p1',
        createdAt: t,
        updatedAt: t,
        peraturan: { tentang: 'x', nomor: 1, tahun: 2020 },
      },
    ],
    relasiSopKeluar: [
      {
        detailSopId: 'det-1',
        detailSopTerkaitId: 'det-2',
        createdAt: t,
        updatedAt: t,
        sopTerkait: {
          detailSopId: 'det-2',
          sopId: 'sop-2',
          nomorSOP: '002',
          sop: { judul: 'Terkait' },
        },
      },
    ],
    lampiranPeringatan: [{ lampiranPeringatanId: 'lp1', teks: 'Peringatan', createdAt: t }],
    lampiranKualifikasiPelaksanaan: [
      { lampiranKualifikasiPelaksanaanId: 'lk1', teks: 'Kual', createdAt: t },
    ],
    lampiranPeralatanPerlengkapan: [
      { lampiranPeralatanPerlengkapanId: 'lpp1', teks: 'Alat', createdAt: t },
    ],
    lampiranPencatatanPendataan: [
      { lampiranPencatatanPendataanId: 'lcp1', teks: 'Catat', createdAt: t },
    ],
    swimlanes: [
      {
        detailSopId: 'det-1',
        pelaksanaId: 'pel-1',
        urutan: 1,
        createdAt: t,
        updatedAt: t,
        pelaksana: { pelaksanaId: 'pel-1', opdId: 'opd-1', nama: 'Staf' },
      },
    ],
    langkahSOP: [
      {
        langkahSopId: 'l1',
        detailSopId: 'det-1',
        urutan: 1,
        kegiatan: 'Kerja',
        jenis: JenisLangkahProsedur.KEGIATAN,
        kelengkapan: 'k',
        keluaran: 'o',
        keterangan: 'ket',
        pelaksanaId: 'pel-1',
        langkahSelanjutnyaYaId: null,
        langkahSelanjutnyaTidakId: null,
        createdAt: t,
        updatedAt: t,
        pelaksana: { pelaksanaId: 'pel-1', nama: 'Staf' },
      },
    ],
    ...overrides,
  } as unknown as SopWorkbenchDbPayload;
}

describe('Pengujian validator kelengkapan SOP', () => {
  it('seharusnya mengembalikan daftar issue kosong ketika workbench lengkap', () => {
    const issues = collectSopWorkbenchCompletenessIssues(buildMinimalWorkbench());
    expect(issues).toHaveLength(0);
  });

  it('seharusnya mengumpulkan issue ketika header dan langkah kosong', () => {
    const issues = collectSopWorkbenchCompletenessIssues(
      buildMinimalWorkbench({
        sop: {
          sopId: 'sop-1',
          opdId: 'opd-1',
          judul: '  ',
          createdAt: new Date(),
          updatedAt: new Date(),
          opd: { opdId: 'opd-1', nama: 'OPD', pengguna: [] },
        },
        nomorSOP: '',
        dasarHukum: [],
        relasiSopKeluar: [],
        swimlanes: [],
        langkahSOP: [],
        lampiranPeringatan: [],
        lampiranKualifikasiPelaksanaan: [],
        lampiranPeralatanPerlengkapan: [],
        lampiranPencatatanPendataan: [],
      }),
    );
    expect(issues.some((p) => p.includes('Judul SOP'))).toBe(true);
    expect(issues.some((p) => p.includes('dasar hukum'))).toBe(true);
  });

  it('seharusnya melempar BadRequestException dengan prefix ketika validasi gagal', () => {
    expect(() =>
      assertSopWorkbenchCompleteForSiapDievaluasi(
        buildMinimalWorkbench({ langkahSOP: [], swimlanes: [] }),
      ),
    ).toThrow(BadRequestException);
    try {
      assertSopWorkbenchCompleteForSiapDievaluasi(
        buildMinimalWorkbench({ langkahSOP: [], swimlanes: [] }),
      );
    } catch (err) {
      expect((err as BadRequestException).message).toContain(
        'SOP belum lengkap untuk status Siap Dievaluasi',
      );
    }
  });
});
