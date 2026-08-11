import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { evaluasiApi } from '@/api/evaluasi'
import { tteApi } from '@/api/tte'
import type { BeritaAcaraTemplateProps } from '@/components/pengajuan/berita-acara-template'
import type { SopPreviewWorkbenchProps } from '@/components/pengajuan/sop-document-preview-pane'
import { queryKeys } from '@/config/query-keys'
import { useToast } from '@/hooks/useToast'
import { downloadBeritaAcaraPdf } from '@/lib/print/download-berita-acara-pdf'
import { ApiError } from '@/lib/api/api-client'
import {
  printSopArsipFromPreviewProps,
  type PengajuanPrintTarget,
} from '@/lib/print/pengajuan-print'
import {
  mapBeritaAcaraTemplateProps,
  type MapBeritaAcaraPengajuanInput,
} from '@/lib/pengajuan/map-berita-acara-template-props'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'

const WORKBENCH_LOGS_LIMIT = 100

interface UsePengajuanCetakArsipParams {
  pengajuanId: string
  pengajuan: MapBeritaAcaraPengajuanInput | null
  effectiveSopDetailId: string | null
  baTemplateProps: BeritaAcaraTemplateProps | null
  sopPreviewProps: SopPreviewWorkbenchProps | null
  tteSignaturePayload?: TTESignaturePayload | null
}

export function usePengajuanCetakArsip({
  pengajuanId,
  pengajuan,
  effectiveSopDetailId,
  baTemplateProps,
  sopPreviewProps,
  tteSignaturePayload = null,
}: UsePengajuanCetakArsipParams) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [cetakLoading, setCetakLoading] = useState(false)

  const prefetchBeritaAcaraArsip = useCallback(async () => {
    const data = await evaluasiApi.findPengajuanBeritaAcara(pengajuanId, { arsip: true })
    queryClient.setQueryData(queryKeys.evaluasiPengajuanBeritaAcara(pengajuanId), data)
    return data
  }, [pengajuanId, queryClient])

  const prefetchSopDokumenArsip = useCallback(
    async (detailSopId: string) => {
      const data = await evaluasiApi.findPengajuanSopDokumen(
        pengajuanId,
        detailSopId,
        WORKBENCH_LOGS_LIMIT,
        { arsip: true },
      )
      queryClient.setQueryData(
        queryKeys.evaluasiPengajuanSopDokumen(
          pengajuanId,
          detailSopId,
          WORKBENCH_LOGS_LIMIT,
        ),
        data,
      )
      return data
    },
    [pengajuanId, queryClient],
  )

  const handleCetak = useCallback(
    async (target: PengajuanPrintTarget) => {
      setCetakLoading(true)
      try {
        if (target === 'ba') {
          const baView = await prefetchBeritaAcaraArsip()
          const freshBaTemplateProps =
            pengajuan !== null
              ? mapBeritaAcaraTemplateProps({ pengajuan, baView })
              : baTemplateProps
          if (freshBaTemplateProps === null) {
            showToast('Data Berita Acara belum siap untuk diunduh.', 'error')
            return
          }
          await downloadBeritaAcaraPdf(freshBaTemplateProps)
          return
        }
        if (effectiveSopDetailId === null) {
          return
        }
        if (sopPreviewProps === null) {
          showToast('Data SOP belum siap untuk dicetak.', 'error')
          return
        }
        await prefetchSopDokumenArsip(effectiveSopDetailId)
        const pdfSigningStatus = await queryClient.fetchQuery({
          queryKey: queryKeys.ttePdfSigningStatus,
          queryFn: () => tteApi.getPdfSigningStatus(),
        })
        const { diagramExportFailed } = await printSopArsipFromPreviewProps(
          sopPreviewProps,
          tteSignaturePayload,
          {
            signPdf: pdfSigningStatus.enabled && Boolean(tteSignaturePayload),
          },
        )
        if (diagramExportFailed) {
          showToast(
            'Diagram tidak dapat diekspor; PDF dicetak dengan tabel langkah sebagai cadangan.',
            'error',
          )
        }
      } catch (err) {
        if (err instanceof ApiError) {
          showToast(err.message, 'error')
          return
        }
        const message =
          err instanceof Error ? err.message : 'Gagal memuat dokumen untuk dicetak'
        showToast(message, 'error')
      } finally {
        setCetakLoading(false)
      }
    },
    [
      baTemplateProps,
      effectiveSopDetailId,
      pengajuan,
      prefetchBeritaAcaraArsip,
      prefetchSopDokumenArsip,
      queryClient,
      showToast,
      sopPreviewProps,
      tteSignaturePayload,
    ],
  )

  return {
    handleCetak,
    cetakLoading,
  }
}
