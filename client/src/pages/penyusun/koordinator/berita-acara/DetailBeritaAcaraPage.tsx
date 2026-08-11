import { useEffect, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  usePengajuanBeritaAcaraView,
  usePengajuanEvaluasiDetail,
  usePengajuanSopDokumenWorkbench,
} from '@/api/evaluasi'
import { PinVerificationDialog } from '@/components/tte/pin-verification-dialog'
import { TteSetupRequiredDialog } from '@/components/tte/tte-setup-required-dialog'
import { createPinConfirmHandler, useTandaTanganiBA } from '@/api/tte'
import { BeritaAcaraPreviewPane } from '@/components/pengajuan/berita-acara-preview-pane'
import { DocumentPreviewTabs } from '@/components/pengajuan/document-preview-tabs'
import { SopDocumentPreviewPane } from '@/components/pengajuan/sop-document-preview-pane'
import { mapBeritaAcaraTemplateProps } from '@/lib/pengajuan/map-berita-acara-template-props'
import { SOPListCard } from '@/components/sop/sop-list-card'
import { DetailPageLayout } from '@/components/layout/DetailPageLayout'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/ui/back-button'
import { NotFoundWithBack } from '@/components/ui/not-found'
import { PengajuanEvaluasiStatusHeader } from '@/components/evaluasi/pengajuan-evaluasi-status-header'
import { InfoCard } from '@/components/ui/info-card'
import { InfoField } from '@/components/ui/info-field'
import {
  CollapsedStripButton,
  CollapsibleSidePanel,
  CollapsibleSidePanelContent,
  CollapsibleSidePanelHeader,
  SimplePanelHeader,
} from '@/components/ui/collapsible-side-panel'
import { mapPenyusunWorkbenchToPreviewProps } from '@/lib/sop/detailSop.mappers'
import { parseTTESignaturePayload } from '@/lib/tte/parse-tte-signature-payload'
import { AlertCircle, CheckCircle, FileText, Loader2 } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { ROUTES } from '@/utils/constants'
import { PengajuanCetakArsipButtons } from '@/components/pengajuan/PengajuanCetakArsipButtons'
import { usePengajuanCetakArsip } from '@/components/pengajuan/hooks/use-pengajuan-cetak-arsip'
import { canCetakBeritaAcaraPengajuan, canCetakSopArsipPengajuan } from '@/lib/print/pengajuan-print'
import { formatDateIdFull } from '@/utils/format-date'
import { useRequireTteSetup } from '@/hooks/use-require-tte-setup'

type PengajuanDetail = NonNullable<ReturnType<typeof usePengajuanEvaluasiDetail>['pengajuan']>
type PengajuanSopList = NonNullable<PengajuanDetail['sopList']>
const EMPTY_SOP_LIST: PengajuanSopList = []

export function DetailBeritaAcaraPage() {
  const { id } = useParams({ from: '/penyusun/pj-penyusun/berita-acara/$id' })
  const [tteDialogOpen, setTteDialogOpen] = useState(false)
  const [previewMainTab, setPreviewMainTab] = useState<'sop' | 'ba'>('ba')
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [selectedSopId, setSelectedSopId] = useState<string | null>(null)
  const { pengajuan, loading: isLoading } = usePengajuanEvaluasiDetail(id)
  const {
    tteSetupDialogOpen,
    setTteSetupDialogOpen,
    requireTteReady,
    handleTteSigningError,
  } = useRequireTteSetup()

  useEffect(() => {
    setSelectedSopId(null)
  }, [id])

  const tandaTanganiBA = useTandaTanganiBA({
    isPjPenyusun: true,
    suppressSetupRequiredToast: true,
  })
  const nomorBaLabel = pengajuan?.nomorBA ?? `BA-${id.slice(0, 8)}`
  const handlePinConfirm = createPinConfirmHandler(
    tandaTanganiBA.mutateAsync,
    (pin) => ({
      pengajuanId: id,
      payload: {
        pin,
        nomorDokumen: nomorBaLabel,
        judulDokumen: `Berita Acara Evaluasi - ${nomorBaLabel}`,
      },
    }),
    undefined,
    (error) => handleTteSigningError(error, () => setTteDialogOpen(false)),
  )
  const handleOpenTteDialog = () => {
    void requireTteReady(() => setTteDialogOpen(true))
  }

  const isReadyForSignature = pengajuan?.status === 'DITANDATANGANI_PJ_EVALUATOR'
  const isAlreadySigned = pengajuan?.status === 'DITANDATANGANI_PJ_PENYUSUN'
  const sopList = pengajuan?.sopList ?? EMPTY_SOP_LIST
  const canCetakBa = canCetakBeritaAcaraPengajuan(pengajuan?.status)
  const canCetakSopArsip = canCetakSopArsipPengajuan(pengajuan?.status)
  const firstSopDetailId = sopList[0]?.sopDetailId ?? null
  const effectiveSopDetailId = selectedSopId ?? firstSopDetailId
  const selectedSop = sopList.find((sop) => sop.sopDetailId === effectiveSopDetailId) ?? null

  const sopWorkbenchEnabled = Boolean(
    effectiveSopDetailId && (previewMainTab === 'sop' || canCetakSopArsip),
  )
  const {
    data: sopDokumen,
    isFetching: sopWorkbenchLoading,
    isError: sopWorkbenchError,
    refetch: refetchSopDokumen,
  } = usePengajuanSopDokumenWorkbench(id, effectiveSopDetailId, {
    enabled: sopWorkbenchEnabled,
  })

  const sopPreviewProps = useMemo(() => {
    const wb = sopDokumen?.workbench
    if (wb === undefined) return null
    return mapPenyusunWorkbenchToPreviewProps(wb)
  }, [sopDokumen])

  const tteSignaturePayloadKepalaOpd = useMemo(
    () => parseTTESignaturePayload(sopDokumen?.tteSignaturePayloadKepalaOpd),
    [sopDokumen?.tteSignaturePayloadKepalaOpd],
  )

  const isSopPreviewLoading = sopWorkbenchEnabled && sopPreviewProps === null && sopWorkbenchLoading
  const { data: baView, isFetching: baViewLoading } = usePengajuanBeritaAcaraView(id, {
    enabled: Boolean(pengajuan && (previewMainTab === 'ba' || canCetakBa)),
  })

  const baTemplateProps = useMemo(
    () =>
      pengajuan != null
        ? mapBeritaAcaraTemplateProps({
            pengajuan,
            baView,
            overrides: {
              namaPjPenyusun: pengajuan.namaPjPenyusun ?? 'PJ Penyusun OPD',
            },
          })
        : null,
    [pengajuan, baView],
  )

  const { handleCetak, cetakLoading } = usePengajuanCetakArsip({
    pengajuanId: id,
    pengajuan,
    effectiveSopDetailId,
    baTemplateProps,
    sopPreviewProps,
    tteSignaturePayload: tteSignaturePayloadKepalaOpd ?? null,
  })

  if (isLoading && pengajuan === null) {
    return (
      <LoadingState className="min-h-[320px]" message="Memuat detail Berita Acara…" />
    )
  }

  if (pengajuan === null) {
    return (
      <NotFoundWithBack
        message="Pengajuan evaluasi tidak ditemukan."
        backAction={
          <BackButton to={ROUTES.PENYUSUN.PJ_PENYUSUN_BERITA_ACARA}>
            Kembali
          </BackButton>
        }
      />
    )
  }

  return (
    <>
      <DetailPageLayout
        breadcrumb={[
          { label: 'PJ Penyusun', to: ROUTES.PENYUSUN.SOP },
          { label: 'Berita Acara', to: ROUTES.PENYUSUN.PJ_PENYUSUN_BERITA_ACARA },
        ]}
        title="Detail Berita Acara"
        description={
          pengajuan.nomorBA
            ? `${pengajuan.nomorBA} — tanda tangani Berita Acara dengan tanda tangan elektronik.`
            : 'Tanda tangani Berita Acara dengan tanda tangan elektronik.'
        }
        backTo={ROUTES.PENYUSUN.PJ_PENYUSUN_BERITA_ACARA}
        backSize="icon"
        header={
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-sm font-semibold text-foreground">Informasi Evaluasi</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <PengajuanCetakArsipButtons
                  printScope="pj-penyusun-kepala-opd"
                  pengajuanStatus={pengajuan.status}
                  effectiveSopDetailId={effectiveSopDetailId}
                  sopCount={sopList.length}
                  cetakLoading={cetakLoading}
                  onCetak={handleCetak}
                />
                {isReadyForSignature && (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={handleOpenTteDialog}
                    disabled={tandaTanganiBA.isPending}
                  >
                    {tandaTanganiBA.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Menandatangani...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Tanda Tangan TTE
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
              <InfoField label="Nomor BA">
                <span className="font-mono">{pengajuan.nomorBA ?? '-'}</span>
              </InfoField>
              <InfoField label="Tanggal Tanda Tangan">{formatDateIdFull(pengajuan.tanggalVerifikasi, '')}</InfoField>
              <InfoField label="Evaluator">{pengajuan.timEvaluasi ?? '-'}</InfoField>
              <InfoField label="Jumlah SOP">{`${sopList.length} dokumen`}</InfoField>
            </div>
            <PengajuanEvaluasiStatusHeader
              status={pengajuan.status}
              statusLabel={pengajuan.statusLabel ?? pengajuan.status}
              role="PJ_PENYUSUN"
            />
            {isReadyForSignature && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-orange-700" />
                  <p className="text-xs text-orange-700">
                    Berita Acara ini telah ditandatangani PJ Evaluator dan menunggu tanda tangan Anda.
                  </p>
                </div>
              </div>
            )}
            {isAlreadySigned && (
              <InfoCard variant="success" icon={<CheckCircle />} title="Berita Acara telah ditandatangani">
                Ditandatangani pada {formatDateIdFull(pengajuan.tanggalTTDBaPjPenyusun, '')}. Menunggu pengesahan
                Kepala OPD.
              </InfoCard>
            )}
          </div>
        }
        leftPanel={
          <CollapsibleSidePanel
            side="left"
            collapsed={leftPanelCollapsed}
            widthCollapsed="w-10"
            widthExpanded="w-[min(380px,40vw)]"
          >
            {leftPanelCollapsed ? (
              <CollapsedStripButton
                label="SOP"
                icon={<FileText className="w-4 h-4" />}
                onClick={() => setLeftPanelCollapsed(false)}
              />
            ) : (
              <>
                <CollapsibleSidePanelHeader
                  side="left"
                  onCollapse={() => setLeftPanelCollapsed(true)}
                  className="border-border bg-surface-subtle/90 px-2 py-1.5 sm:px-2.5"
                >
                  <SimplePanelHeader title="Daftar SOP" />
                </CollapsibleSidePanelHeader>
                <CollapsibleSidePanelContent className="px-2 pb-2 pt-1 sm:px-2">
                  <SOPListCard
                    items={sopList.map((sop) => ({
                      id: sop.sopDetailId,
                      nama: sop.nama,
                      nomor: sop.nomor,
                      statusDokumen: sop.status,
                      statusDokumenLabel: sop.statusLabel ?? sop.status,
                      hasilEvaluasi: sop.hasil,
                      hasilEvaluasiLabel: sop.hasilLabel,
                    }))}
                    selectedId={effectiveSopDetailId}
                    onSelect={setSelectedSopId}
                  />
                </CollapsibleSidePanelContent>
              </>
            )}
          </CollapsibleSidePanel>
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <DocumentPreviewTabs
            value={previewMainTab}
            onValueChange={setPreviewMainTab}
            tabs={[
              {
                value: 'sop',
                label: 'Pratinjau SOP',
                contentClassName:
                  'mt-3 flex min-h-0 flex-1 flex-col overflow-auto px-2 pb-2',
                content: (
                  <SopDocumentPreviewPane
                    selectedSop={selectedSop}
                    isLoading={isSopPreviewLoading}
                    sopPreviewProps={sopPreviewProps}
                    tteSignaturePayload={tteSignaturePayloadKepalaOpd ?? null}
                    loadingMessage="Memuat dokumen SOP…"
                    errorMessage={
                      sopWorkbenchError
                        ? 'Dokumen lengkap SOP dalam pengajuan evaluasi tidak dapat dimuat.'
                        : undefined
                    }
                    onRetry={
                      sopWorkbenchError ? () => void refetchSopDokumen() : undefined
                    }
                  />
                ),
              },
              {
                value: 'ba',
                label: 'Berita Acara',
                contentClassName:
                  'mt-2 flex min-h-0 flex-1 flex-col overflow-auto px-1 pb-1 sm:px-2',
                content:
                  baTemplateProps != null ? (
                    <BeritaAcaraPreviewPane
                      isLoading={baViewLoading && baTemplateProps == null}
                      templateProps={baTemplateProps}
                    />
                  ) : null,
              },
            ]}
          />
        </div>
      </DetailPageLayout>

      <PinVerificationDialog
        open={tteDialogOpen}
        onOpenChange={setTteDialogOpen}
        title="Tanda Tangan — PIN TTE"
        description="Masukkan PIN TTE untuk menandatangani Berita Acara ini (simulasi)."
        onConfirm={handlePinConfirm}
      />
      <TteSetupRequiredDialog
        open={tteSetupDialogOpen}
        onOpenChange={setTteSetupDialogOpen}
      />
    </>
  )
}
