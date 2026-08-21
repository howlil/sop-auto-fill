import { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Settings2 } from 'lucide-react'
import { SOPPreviewTemplate } from '@/components/sop/sop-preview-template'
import type { SOPDetailMetadata } from '@/types/ui/sop'
import { namaLembagaToInstitutionLines } from '@/lib/sop/detailSop.mappers'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { useSopEditor } from '../SopEditorContext'
import { usePenyusunWorkbench } from '@/api/sop'
import { usePenyusunDiagramConfig } from '../../hooks/use-penyusun-diagram-config'

export interface DetailSOPPenyusunMainProps {
  activeTab: 'flowchart' | 'bpmn'
  onActiveTabChange: (tab: 'flowchart' | 'bpmn') => void
}

function toArrayField(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.length > 0) return [value]
  return []
}

function scheduleDiagramIdleMount(onReady: () => void): () => void {
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(onReady, { timeout: 3000 })
    return () => cancelIdleCallback(id)
  }
  const id = window.setTimeout(onReady, 200)
  return () => clearTimeout(id)
}

function toPreviewMetadata(meta: SOPDetailMetadata) {
  const institutionLines =
    meta.institutionLines !== undefined && meta.institutionLines.length > 0
      ? meta.institutionLines
      : namaLembagaToInstitutionLines(meta.lembaga)
  return {
    name: meta.nama ?? meta.judul ?? '',
    number: meta.nomorSOP ?? meta.nomor ?? '',
    lembaga: meta.lembaga,
    institutionLines,
    logoUrl: meta.logoUrl,
    version: meta.version ?? 1,
    createdDate: meta.tanggalPembuatan ?? '',
    revisionDate: meta.tanggalRevisi ?? '',
    effectiveDate: meta.tanggalEfektif ?? '',
    picName: meta.picName ?? '',
    picNumber: meta.picNumber ?? '',
    lawBasis: meta.lawBasis ?? [],
    relatedSop: meta.relatedSop ?? [],
    warning: toArrayField(meta.warning),
    implementQualification: toArrayField(meta.implementQualification),
    equipment: toArrayField(meta.equipment),
    recordData: toArrayField(meta.recordData),
  }
}

export function DetailSOPPenyusunMain({
  activeTab,
  onActiveTabChange,
}: DetailSOPPenyusunMainProps) {
  const { sopDetailId, metadata, prosedurRows, implementers, isReadOnly } = useSopEditor()
  const { data: workbench, isLoading: isWorkbenchLoading } = usePenyusunWorkbench(sopDetailId)
  const [allowDiagramRender, setAllowDiagramRender] = useState(false)
  const isWorkbenchDataReady = Boolean(workbench?.detail.id) && !isWorkbenchLoading

  useEffect(() => {
    setAllowDiagramRender(false)
  }, [sopDetailId])

  useEffect(() => {
    if (!isWorkbenchDataReady || allowDiagramRender) return
    return scheduleDiagramIdleMount(() => setAllowDiagramRender(true))
  }, [isWorkbenchDataReady, allowDiagramRender])

  const diagramConfig = usePenyusunDiagramConfig({
    detailSopId: sopDetailId,
    workbench,
    prosedurRows,
    implementers,
    activeTab,
    enabled: !isReadOnly && isWorkbenchDataReady && allowDiagramRender,
  })
  const isDiagramReady = isWorkbenchDataReady && diagramConfig.isDiagramHydrated
  const diagramMountEnabled = allowDiagramRender && isDiagramReady

  const handleActiveTabChange = useCallback(
    (tab: 'flowchart' | 'bpmn') => {
      setAllowDiagramRender(true)
      onActiveTabChange(tab)
    },
    [onActiveTabChange],
  )

  const previewMetadata = useMemo(() => toPreviewMetadata(metadata), [metadata])

  const toolbar = !isReadOnly ? (
    <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Pengaturan diagram lanjutan">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('gap-1.5', diagramConfig.isEditingDiagramPaths && 'border-primary/40 bg-primary-subtle text-primary')}
        onClick={() => {
          diagramConfig.setIsEditingDiagramPaths((value) => !value)
          diagramConfig.setSelectedConnectionId(null)
        }}
      >
        <Settings2 className="h-3.5 w-3.5" />
        {diagramConfig.isEditingDiagramPaths ? 'Selesai atur layout' : 'Atur layout diagram'}
      </Button>
      {diagramConfig.isEditingDiagramPaths ? (
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={diagramConfig.handleResetAllPaths}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset path
        </Button>
      ) : null}
    </div>
  ) : null

  return (
    <section className="mx-auto w-full max-w-[1500px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Preview</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Dokumen dan diagram</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tampilan ini dihasilkan dari data editor. Gunakan tab Flowchart/BPMN pada dokumen untuk mengganti representasi proses.
          </p>
        </div>
        {toolbar}
      </div>

      <div className="overflow-auto rounded-2xl border border-border bg-background p-3 sm:p-5">
        <SOPPreviewTemplate
          metadata={previewMetadata}
          prosedurRows={prosedurRows}
          implementers={implementers}
          diagramState={{
            pathLayoutSeed: diagramConfig.pathLayoutSeed,
            activeTab,
            onActiveTabChange: handleActiveTabChange,
            diagramMountEnabled,
            onRequestDiagramMount: () => setAllowDiagramRender(true),
            editMode: diagramConfig.isEditingDiagramPaths,
            arrowConfig: diagramConfig.effectiveArrowConfig,
            labelConfig: diagramConfig.labelConfig,
            selectedConnectionId: diagramConfig.selectedConnectionId,
            onSelectConnection: diagramConfig.setSelectedConnectionId,
            onManualPathChange: diagramConfig.handleManualPathChange,
            onResetSelectedPath: diagramConfig.handleResetSelectedPath,
          }}
          previewOptions={{ toolbar: null }}
        />
      </div>
    </section>
  )
}
