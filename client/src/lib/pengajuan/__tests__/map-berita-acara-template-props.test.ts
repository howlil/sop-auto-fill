import { describe, expect, it } from 'vitest'
import { mapBeritaAcaraTemplateProps } from '../map-berita-acara-template-props'
import type { BeritaAcaraEvaluasiView } from '@/types/dto/evaluasi.dto'

const baView: BeritaAcaraEvaluasiView = {
  namaOpd: 'Dinas dari BA',
  nomorBA: 'BA-001',
  tanggalVerifikasiPjEvaluator: '2026-01-15',
  nilaiKeseluruhanOpd: 88,
  hasilPerSop: [],
  timEvaluasi: {
    penanggungJawabSelesai: { id: 'pj-1', nama: 'PJ dari tim' },
    evaluatorNamaUnik: [],
  },
  tteBeritaAcara: {
    dokumenTteId: 'doc-1',
    hashDokumen: 'hash',
    versiDokumen: 1,
    adaRiwayatTandaTanganPerPeran: {},
  },
}

describe('mapBeritaAcaraTemplateProps', () => {
  it('should_prefer_baView_fields_over_pengajuan', () => {
    const actual = mapBeritaAcaraTemplateProps({
      pengajuan: {
        opdNama: 'OPD Pengajuan',
        nomorBA: 'PG-99',
        tanggalVerifikasi: '2025-12-01',
        namaPjEvaluator: 'Evaluator Pengajuan',
        namaPjPenyusun: 'Penyusun Pengajuan',
        nilaiOPD: 70,
      },
      baView,
    })
    expect(actual.opd).toBe('Dinas dari BA')
    expect(actual.nomorBA).toBe('BA-001')
    expect(actual.tanggalVerifikasi).toBe('2026-01-15')
    expect(actual.nilaiKeseluruhanOpd).toBe(88)
    expect(actual.namaBiro).toBe('Evaluator Pengajuan')
    expect(actual.namaPjPenyusun).toBe('Penyusun Pengajuan')
    expect(actual.forPrint).toBe(true)
  })

  it('should_fallback_namaBiro_to_tim_evaluasi_when_pengajuan_missing', () => {
    const actual = mapBeritaAcaraTemplateProps({
      pengajuan: { opdNama: 'OPD' },
      baView,
    })
    expect(actual.namaBiro).toBe('PJ dari tim')
  })

  it('should_use_baView_namaOpd_when_pengajuan_has_no_opd_fields', () => {
    const actual = mapBeritaAcaraTemplateProps({
      pengajuan: {
        nomorBA: 'PG-99',
        namaPjPenyusun: 'Budi Penyusun',
      },
      baView,
    })
    expect(actual.opd).toBe('Dinas dari BA')
    expect(actual.namaPjPenyusun).toBe('Budi Penyusun')
  })

  it('should_apply_overrides_after_defaults', () => {
    const actual = mapBeritaAcaraTemplateProps({
      pengajuan: {
        opdNama: 'OPD Pengajuan',
        namaPjPenyusun: 'Penyusun Pengajuan',
      },
      baView,
      overrides: {
        opd: 'OPD Override',
        namaPjPenyusun: 'Penyusun Override',
      },
    })
    expect(actual.opd).toBe('OPD Override')
    expect(actual.namaPjPenyusun).toBe('Penyusun Override')
  })
})
