import {
  HasilEvaluasi,
  JenisLangkahProsedur,
  SatuanWaktu,
  StatusSOP,
} from '../../../generated/prisma';
import { buildNilaiEvaluasiClientId } from '../../evaluation/nilai/nilai-evaluasi-client-id';
import type { SopWorkbenchDbPayload } from './sop-catalog.repository';
import { mapDaftarRow, mapWorkbenchPayload, toIso } from './sop-catalog.mapper';

describe('Pengujian SopCatalogMapper', () => {
  it('seharusnya memformat tanggal sebagai string ISO', () => {
    const d = new Date('2026-03-01T08:00:00.000Z');
    expect(toIso(d)).toBe('2026-03-01T08:00:00.000Z');
  });

  it('seharusnya memetakan workbench dengan keputusan langkah dan nilai evaluasi', () => {
    const t = new Date('2026-03-02T10:00:00.000Z');
    const row = {
      detailSopId: 'det-1',
      sopId: 'sop-1',
      status: StatusSOP.DRAFT,
      versi: 1,
      nomorSOP: '001/2026',
      tanggalPembuatan: t,
      tanggalRevisi: null,
      tanggalEfektif: null,
      namaLembaga: 'Lembaga',
      dibuatOlehId: 'p1',
      terakhirDieditOlehId: null,
      revisiDariDetailSopId: null,
      revisiDari: null,
      createdAt: t,
      updatedAt: t,
      sop: {
        sopId: 'sop-1',
        opdId: 'opd-1',
        judul: 'Judul SOP',
        createdAt: t,
        updatedAt: t,
        opd: { opdId: 'opd-1', nama: 'OPD', pengguna: [] },
      },
      dibuatOleh: { penggunaId: 'p1', nama: 'Budi' },
      terakhirDieditOleh: null,
      lampiranPeringatan: [{ lampiranPeringatanId: 'lp1', teks: 'Awas', createdAt: t }],
      lampiranKualifikasiPelaksanaan: [],
      lampiranPeralatanPerlengkapan: [],
      lampiranPencatatanPendataan: [],
      dasarHukum: [
        {
          peraturanId: 'per-1',
          createdAt: t,
          updatedAt: t,
          peraturan: { tentang: 'UU X', nomor: 1, tahun: 2020 },
        },
      ],
      relasiSopKeluar: [],
      relasiSopMasuk: [],
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
      nilaiEvaluasi: [
        {
          pengajuanEvaluasiId: 'pe-1',
          detailSopId: 'det-1',
          hasil: HasilEvaluasi.PERLU_PERBAIKAN,
          catatan: 'Perbaiki',
        },
      ],
      langkahSOP: [
        {
          langkahSopId: 'lang-1',
          detailSopId: 'det-1',
          urutan: 1,
          kegiatan: 'Putuskan',
          jenis: JenisLangkahProsedur.KEPUTUSAN,
          kelengkapan: 'k',
          keluaran: 'o',
          waktu: 1,
          satuanWaktu: SatuanWaktu.m,
          keterangan: 'ket',
          pelaksanaId: 'pel-1',
          langkahSelanjutnyaYaId: 'lang-2',
          langkahSelanjutnyaTidakId: 'lang-3',
          createdAt: t,
          updatedAt: t,
          pelaksana: { pelaksanaId: 'pel-1', nama: 'Staf' },
        },
      ],
      logEditSop: [],
    } as unknown as SopWorkbenchDbPayload;
    const actual = mapWorkbenchPayload(row);
    expect(actual.detail.nilaiEvaluasi?.[0]).toMatchObject({
      id: buildNilaiEvaluasiClientId('pe-1', 'det-1'),
    });
    expect(actual.langkah[0]?.jenis).toBe(String(JenisLangkahProsedur.KEPUTUSAN));
    expect(actual.detail.dasarHukumPeraturanIds).toEqual(['per-1']);
  });

  it('seharusnya memetakan baris daftar dengan flag versi berlaku', () => {
    const t = new Date('2026-01-15T10:00:00.000Z');
    const actual = mapDaftarRow({
      sopId: 'sop-1',
      opdId: 'opd-1',
      judul: 'Judul',
      detail: {
        detailSopId: 'det-1',
        nomorSOP: '001',
        status: StatusSOP.BERLAKU,
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Ani',
        peraturanId: 'per-1',
      },
      versiBerlaku: {
        detailSopId: 'det-1',
        versi: 1,
        nomorSOP: '001',
        status: StatusSOP.BERLAKU,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Ani',
        peraturanId: 'per-1',
      },
      allStatuses: [StatusSOP.BERLAKU],
    });
    expect(actual.canBuatVersiBaru).toBe(true);
    expect(actual.canCabutSop).toBe(true);
    expect(actual.canHapusSopDraft).toBe(false);
    expect(actual.versiBerlaku?.detailSopId).toBe('det-1');
  });

  it('seharusnya mengizinkan hapus SOP hanya untuk draft awal satu-satunya', () => {
    const t = new Date('2026-01-15T10:00:00.000Z');
    const actual = mapDaftarRow({
      sopId: 'sop-draft',
      opdId: 'opd-1',
      judul: 'Draft awal',
      detail: {
        detailSopId: 'det-draft',
        nomorSOP: 'DRAFT-001',
        status: StatusSOP.DRAFT,
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Budi',
        peraturanId: null,
      },
      versiBerlaku: null,
      allStatuses: [StatusSOP.DRAFT],
    });
    expect(actual.canHapusSopDraft).toBe(true);
  });

  it('seharusnya mengizinkan versi baru dari SOP yang versi pertamanya ditolak', () => {
    const t = new Date('2026-08-02T10:00:00.000Z');
    const actual = mapDaftarRow({
      sopId: 'sop-ditolak',
      opdId: 'opd-1',
      judul: 'SOP Ditolak',
      detail: {
        detailSopId: 'det-v1',
        nomorSOP: 'REJECT-001',
        status: StatusSOP.DITOLAK_EVALUATOR,
        versi: 1,
        updatedAt: t,
        pembuatNama: 'Budi',
        editorNama: 'Budi',
        peraturanId: null,
      },
      versiBerlaku: null,
      allStatuses: [StatusSOP.DITOLAK_EVALUATOR],
    });

    expect(actual.canBuatVersiBaru).toBe(true);
    expect(actual.canCabutSop).toBe(false);
  });
});
