import { describe, expect, it } from 'vitest'
import {
  buildAjukanEvaluasiSnapshotRows,
  canKirimUlangSetelahRevisi,
  deriveTahapPenilaianSop,
  getAjukanEvaluasiBlockingReason,
  getKirimUlangBlockingReason,
  getTahapPenilaianCopy,
  hasHasilEvaluasiTersimpan,
  isDetailDiperbaruiSetelahTindakLanjut,
} from '../evaluasi-domain'
import type {
  EvaluasiWorkspacePengajuanAktif,
  UmpanBalikEvaluasiDetail,
} from '@/types/dto/evaluasi.dto'

function pengajuan(
  nilaiPerDetail: EvaluasiWorkspacePengajuanAktif['nilaiPerDetail'],
): EvaluasiWorkspacePengajuanAktif {
  return {
    id: 'pengajuan-1',
    status: 'SEDANG_DIEVALUASI',
    statusLabel: 'Sedang dievaluasi',
    jenis: 'EVALUASI_REQUEST_EVALUATOR',
    version: 0,
    alasanPenolakan: null,
    tanggalDitolak: null,
    nilaiPerDetail,
  }
}

describe('evaluasi-domain', () => {
  it('should_not_treat_BELUM_DINILAI_as_saved_hasil', () => {
    expect(hasHasilEvaluasiTersimpan('BELUM_DINILAI')).toBe(false)
    expect(hasHasilEvaluasiTersimpan(null)).toBe(false)
    expect(hasHasilEvaluasiTersimpan('SESUAI')).toBe(true)
    expect(hasHasilEvaluasiTersimpan('PERLU_PERBAIKAN')).toBe(true)
    expect(hasHasilEvaluasiTersimpan('DITOLAK')).toBe(true)
  })

  it('should_block_submit_based_on_server_saved_detail_results', () => {
    const result = getAjukanEvaluasiBlockingReason(
      pengajuan([
        {
          detailSopId: 'detail-1',
          hasil: 'BELUM_DINILAI',
          hasilLabel: 'Belum dinilai',
          catatan: null,
          version: 1,
          statusTindakLanjut: null,
          statusTindakLanjutLabel: null,
          ditindaklanjutiPada: null,
          versi: 1,
          detailUpdatedAt: '2026-05-19T00:00:00.000Z',
        },
      ]),
      5,
    )

    expect(result).toContain('Masih ada 1 SOP')
  })

  it('should_build_submit_snapshot_from_server_saved_detail_results', () => {
    const rows = buildAjukanEvaluasiSnapshotRows(
      pengajuan([
        {
          detailSopId: 'detail-1',
          hasil: 'BELUM_DINILAI',
          hasilLabel: 'Belum dinilai',
          catatan: null,
          version: 1,
          statusTindakLanjut: null,
          statusTindakLanjutLabel: null,
          ditindaklanjutiPada: null,
          versi: 1,
          detailUpdatedAt: '2026-05-19T00:00:00.000Z',
        },
      ]),
      new Map([
        ['detail-1', { judul: 'SOP Uji', nomorSOP: '001' }],
      ]),
    )

    expect(rows).toEqual([
      {
        detailSopId: 'detail-1',
        judul: 'SOP Uji',
        nomorSOP: '001',
        hasilLabel: 'Belum dinilai',
      },
    ])
  })
})

function umpanBalik(
  statusTindakLanjut: UmpanBalikEvaluasiDetail['statusTindakLanjut'],
): UmpanBalikEvaluasiDetail {
  return {
    pengajuanEvaluasiId: 'pengajuan-1',
    pengajuanStatus: 'SEDANG_DIEVALUASI',
    detailSopId: 'detail-1',
    hasil: 'PERLU_PERBAIKAN',
    hasilLabel: 'Perlu perbaikan',
    catatan: 'Perbaiki SLA',
    statusTindakLanjut,
    statusTindakLanjutLabel:
      statusTindakLanjut === 'SELESAI' ? 'Selesai' : 'Terbuka',
    ditindaklanjutiPada: null,
    version: 1,
    dinilaiOleh: { id: 'eval-1', nama: 'Evaluator' },
  }
}

describe('deriveTahapPenilaianSop', () => {
  it('should_return_tinjauan_ulang_when_perlu_selesai_and_diajukan', () => {
    expect(
      deriveTahapPenilaianSop({
        hasil: 'PERLU_PERBAIKAN',
        statusTindakLanjut: 'SELESAI',
        statusDetail: 'DIAJUKAN_EVALUASI',
      }),
    ).toBe('tinjauan_ulang')
  })

  it('should_return_menunggu_perbaikan_when_terbuka_or_revisi', () => {
    expect(
      deriveTahapPenilaianSop({
        hasil: 'PERLU_PERBAIKAN',
        statusTindakLanjut: 'TERBUKA',
        statusDetail: 'REVISI_DARI_EVALUATOR',
      }),
    ).toBe('menunggu_perbaikan_opd')
  })

  it('should_return_sesuai_or_belum_dinilai', () => {
    expect(
      deriveTahapPenilaianSop({
        hasil: 'SESUAI',
        statusTindakLanjut: null,
        statusDetail: 'DIAJUKAN_EVALUASI',
      }),
    ).toBe('sesuai')
    expect(
      deriveTahapPenilaianSop({
        hasil: 'BELUM_DINILAI',
        statusTindakLanjut: null,
        statusDetail: 'DIAJUKAN_EVALUASI',
      }),
    ).toBe('belum_dinilai')
  })

  it('should_return_ditolak_as_terminal_stage', () => {
    expect(
      deriveTahapPenilaianSop({
        hasil: 'DITOLAK',
        statusTindakLanjut: null,
        statusDetail: 'DITOLAK_EVALUATOR',
      }),
    ).toBe('ditolak')
    expect(getTahapPenilaianCopy('ditolak').bannerDescription).toContain('versi baru')
  })

  it('should_expose_copy_for_tinjauan_ulang', () => {
    const copy = getTahapPenilaianCopy('tinjauan_ulang')
    expect(copy.badgeLabel).toBe('Siap tinjau ulang')
    expect(copy.bannerTitle).not.toBeNull()
  })

  it('should_detect_detail_updated_after_tindak_lanjut', () => {
    expect(
      isDetailDiperbaruiSetelahTindakLanjut(
        '2026-05-20T10:00:00.000Z',
        '2026-05-19T08:00:00.000Z',
      ),
    ).toBe(true)
    expect(
      isDetailDiperbaruiSetelahTindakLanjut(
        '2026-05-19T08:00:00.000Z',
        '2026-05-20T10:00:00.000Z',
      ),
    ).toBe(false)
  })
})

describe('kirim ulang setelah revisi', () => {
  it('should_allow_kirim_ulang_when_status_terbuka', () => {
    const input = umpanBalik('TERBUKA')
    expect(canKirimUlangSetelahRevisi(input)).toBe(true)
    expect(getKirimUlangBlockingReason(input)).toBeNull()
  })

  it('should_allow_kirim_ulang_when_status_selesai', () => {
    const input = umpanBalik('SELESAI')
    expect(canKirimUlangSetelahRevisi(input)).toBe(true)
    expect(getKirimUlangBlockingReason(input)).toBeNull()
  })

  it('should_block_when_umpan_balik_missing', () => {
    expect(canKirimUlangSetelahRevisi(null)).toBe(false)
    expect(getKirimUlangBlockingReason(undefined)).toContain('Tidak ada umpan balik')
  })

  it('should_block_resubmit_for_rejected_version', () => {
    const input: UmpanBalikEvaluasiDetail = {
      ...umpanBalik(null),
      pengajuanStatus: 'DITOLAK',
      hasil: 'DITOLAK',
      hasilLabel: 'Ditolak',
    }
    expect(canKirimUlangSetelahRevisi(input)).toBe(false)
    expect(getKirimUlangBlockingReason(input)).toContain('Buat versi baru')
  })
})
