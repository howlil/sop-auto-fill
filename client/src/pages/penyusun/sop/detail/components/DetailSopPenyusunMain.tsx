import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListTree, PenLine, RotateCcw } from 'lucide-react'
import { SOPPreviewTemplate } from '@/components/sop/sop-preview-template'
import { DetailSOPProsedurEditor } from './DetailSopProsedurEditor'
import type { SOPDetailMetadata } from "@/types/ui/sop";
import { namaLembagaToInstitutionLines } from '@/lib/sop/detailSop.mappers'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import { useSopEditor } from '../SopEditorContext'
import { usePenyusunWorkbench } from '@/api/sop'
import { usePenyusunDiagramConfig } from '../../hooks/use-penyusun-diagram-config'

export interface DetailSOPPenyusunMainProps {
  activeTab: 'flowchart' | 'bpmn'
  onActiveTabChange: (tab: 'flowchart' | 'bpmn') => void
  isEditingSteps: boolean
  setIsEditingSteps: (editing: boolean) => void
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
      : namaLembagaToInstitutionLines(meta.lembaga);
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
  isEditingSteps,
  setIsEditingSteps,
}: DetailSOPPenyusunMainProps) {
  const { sopDetailId, metadata, prosedurRows, setProsedurRows, implementers, isReadOnly } = useSopEditor()
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

  const handleToggleManualEdit = () => {
    if (isEditingSteps) {
      setIsEditingSteps(false)
      diagramConfig.setIsEditingDiagramPaths(true)
      diagramConfig.setSelectedConnectionId(null)
      return
    }
    diagramConfig.setIsEditingDiagramPaths((value) => !value)
    diagramConfig.setSelectedConnectionId(null)
  }

  const toolbar = (
    <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-lg bg-surface/55 p-0.5 ring-1 ring-border/70" role="group" aria-label="Kontrol dokumen SOP">
      {!isReadOnly ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium text-secondary-foreground',
              isEditingSteps ? 'bg-surface text-foreground shadow-surface ring-1 ring-border/90' : 'hover:bg-surface/90',
            )}
            title={isEditingSteps ? 'Kembali ke pratinjau diagram' : 'Edit langkah prosedur dalam tabel'}
            onClick={() => setIsEditingSteps(!isEditingSteps)}
          >
            <ListTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {isEditingSteps ? 'Diagram' : 'Langkah'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium text-secondary-foreground hover:bg-surface/90',
              diagramConfig.isEditingDiagramPaths ? 'bg-surface text-foreground shadow-surface ring-1 ring-border/90' : '',
            )}
            onClick={handleToggleManualEdit}
            title="Edit path panah diagram secara manual"
          >
            <PenLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            Edit Manual
          </Button>
          {diagramConfig.isEditingDiagramPaths ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-md px-2.5 text-xs font-medium text-secondary-foreground hover:bg-surface/90"
              onClick={diagramConfig.handleResetAllPaths}
              title="Reset semua path ke routing otomatis"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              Reset semua path
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  )

  const diagramAlternate =
    !isReadOnly && isEditingSteps ? (
      <div className="print:hidden w-full">
        <DetailSOPProsedurEditor
          prosedurRows={prosedurRows}
          setProsedurRows={setProsedurRows}
          implementers={implementers}
          onDone={() => setIsEditingSteps(false)}
        />
      </div>
    ) : undefined

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto p-4">
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
        previewOptions={{ toolbar, diagramAlternate }}
      />
    </div>
  )
}
