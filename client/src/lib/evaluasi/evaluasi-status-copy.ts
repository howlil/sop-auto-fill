import type { StatusPengajuanEvaluasi } from '@/types/dto/evaluasi.dto'

export type EvaluasiBannerRole = 'EVALUATOR' | 'PJ_EVALUATOR' | 'PJ_PENYUSUN' | 'KEPALA_OPD' | 'GENERAL'

export interface EvaluasiStatusBanner {
  variant: 'info' | 'success' | 'warning' | 'danger'
  title: string
  message: string
}

export function getEvaluasiStatusBanner(
  status: StatusPengajuanEvaluasi | string | undefined,
  role: EvaluasiBannerRole = 'GENERAL',
): EvaluasiStatusBanner | null {
  if (status === undefined || status === '') return null
  switch (status) {
    case 'SEDANG_DIEVALUASI':
      if (role === 'EVALUATOR') {
        return {
          variant: 'info',
          title: 'Penilaian sedang berlangsung',
          message:
            'Lengkapi penilaian setiap SOP. Setelah semua Sesuai, ajukan tanda tangan Berita Acara ke PJ Evaluator.',
        }
      }
      return {
        variant: 'info',
        title: 'Pengajuan evaluasi sedang dinilai tim evaluator',
        message: 'Menunggu penilaian selesai untuk seluruh dokumen dalam pengajuan ini.',
      }
    case 'DITOLAK':
      return {
        variant: 'danger',
        title: 'Pengajuan ditolak evaluator',
        message:
          'Seluruh versi SOP dalam pengajuan ini ditutup dan tidak dapat diajukan ulang. Penyusun wajib membuat versi baru dan pengajuan baru.',
      }
    case 'SELESAI_DIEVALUASI':
      if (role === 'PJ_EVALUATOR') {
        return {
          variant: 'warning',
          title: 'Menunggu tanda tangan BA',
          message: 'Tim evaluator menyelesaikan penilaian. Tanda tangani Berita Acara.',
        }
      }
      return {
        variant: 'info',
        title: 'Menunggu tanda tangan BA',
        message: 'Penilaian tim selesai. PJ Evaluator akan menandatangani Berita Acara.',
      }
    case 'DITANDATANGANI_PJ_EVALUATOR':
      if (role === 'PJ_PENYUSUN') {
        return {
          variant: 'warning',
          title: 'Tanda tangani Berita Acara',
          message:
            'BA sudah ditandatangani PJ Evaluator. Tanda tangani BA, lalu Kepala OPD mengesahkan setiap SOP agar berstatus Berlaku.',
        }
      }
      return {
        variant: 'success',
        title: 'BA ditandatangani PJ Evaluator',
        message: 'PJ Penyusun dapat melanjutkan tanda tangan BA. Setelah itu Kepala OPD mengesahkan SOP.',
      }
    case 'DITANDATANGANI_PJ_PENYUSUN':
      if (role === 'KEPALA_OPD') {
        return {
          variant: 'warning',
          title: 'Pengesahan SOP diperlukan',
          message:
            'BA OPD sudah ditandatangani. Tanda tangani setiap SOP dalam pengajuan evaluasi agar status dokumen menjadi Berlaku.',
        }
      }
      return {
        variant: 'info',
        title: 'Menunggu pengesahan Kepala OPD',
        message: 'BA OPD sudah ditandatangani. Kepala OPD akan mengesahkan tiap SOP.',
      }
    case 'SELESAI':
      return {
        variant: 'success',
        title: 'Pengajuan evaluasi selesai',
        message:
          'Seluruh SOP dalam pengajuan ini berstatus Berlaku. Berita Acara dapat dicetak sebagai arsip.',
      }
    default:
      return null
  }
}
