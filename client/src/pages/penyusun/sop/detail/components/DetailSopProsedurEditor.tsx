import { MoreHorizontal, Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useProsedurEditor } from '@/pages/penyusun/sop/hooks/use-prosedur-editor'
import { useToast } from '@/hooks/useToast'
import {
  KegiatanCell,
  TypeCell,
  ImplementerCell,
  MutuKelengkapanCell,
  MutuWaktuCell,
  OutputCell,
  KeteranganCell,
} from './ProsedurEditorCells'
import { DecisionStepDialog } from './DecisionStepDialog'
import type { ProsedurRow } from '@/types/ui/sop'
import {
  formatProsedurValidationMessage,
  validateProsedurRows,
} from '@/lib/sop/validateProsedurRows'

export interface DetailSOPProsedurEditorProps {
  prosedurRows: ProsedurRow[]
  setProsedurRows: React.Dispatch<React.SetStateAction<ProsedurRow[]>>
  implementers: { id: string; name: string }[]
  onDone: () => void
  readOnly?: boolean
}

export function DetailSOPProsedurEditor({
  prosedurRows,
  setProsedurRows,
  implementers,
  onDone,
  readOnly = false,
}: DetailSOPProsedurEditorProps) {
  const { showToast } = useToast()
  const {
    isDecisionDialogOpen,
    setIsDecisionDialogOpen,
    decisionStepIndex,
    decisionYesId,
    decisionNoId,
    setDecisionYesId,
    setDecisionNoId,
    handleAddRow,
    handleDeleteRow,
    handleTypeChange,
    handleKegiatanChange,
    handlePelaksanaChange,
    handleMutuKelengkapanChange,
    handleMutuWaktuChange,
    handleOutputChange,
    handleKeteranganChange,
    handleDecisionConfig,
  } = useProsedurEditor(prosedurRows, setProsedurRows)

  const hasImplementers = implementers.length > 0
  const stepOrderById = Object.fromEntries(
    prosedurRows.map((row, idx) => [row.id, idx + 1]),
  ) as Record<string, number>

  const guardedAddRow = (index: number) => {
    if (readOnly) return
    if (!hasImplementers) {
      showToast(
        'Tambahkan minimal satu aktor pelaksana terlebih dahulu sebelum menambah langkah.',
        'error',
      )
      return
    }
    handleAddRow(index, implementers)
  }

  const handleDone = () => {
    if (readOnly) {
      onDone()
      return
    }
    const validation = validateProsedurRows(prosedurRows, implementers.length)
    if (!validation.valid) {
      showToast(formatProsedurValidationMessage(validation.errors), 'error')
      return
    }
    onDone()
  }

  const renderRowActions = (row: ProsedurRow, realIdx: number) => {
    if (readOnly) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-secondary-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Aksi langkah ${realIdx + 1}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[13rem]">
          {row.type === 'decision' ? (
            <DropdownMenuItem
              onClick={() =>
                handleDecisionConfig(
                  realIdx,
                  row.id_next_step_if_yes || '',
                  row.id_next_step_if_no || '',
                )
              }
            >
              <Settings2 className="mr-1.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <span>Atur cabang decision</span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => guardedAddRow(realIdx)}>
            <span className="mr-1.5 text-primary" aria-hidden>+</span>
            <span>Tambah langkah setelah ini</span>
          </DropdownMenuItem>
          {prosedurRows.length > 1 ? (
            <DropdownMenuItem
              onClick={() => handleDeleteRow(realIdx)}
              className="text-red-600 focus:text-red-600"
            >
              <X className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Hapus langkah</span>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="mb-7">
        <div className="flex items-center gap-2 text-primary">
          <span className="text-sm font-semibold">Langkah 3</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Prosedur</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Susun proses dari awal hingga akhir. Setiap kartu mewakili satu langkah; tabel formal, Flowchart, dan BPMN akan dibuat dari data yang sama pada Preview.
        </p>
      </div>

      {!hasImplementers && !readOnly ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tambahkan minimal satu pelaksana pada bagian <strong>Pelaksana</strong> sebelum menambah langkah baru.
        </div>
      ) : null}

      <div className="space-y-4" aria-label="Editor langkah prosedur">
        {prosedurRows.map((row, realIdx) => (
          <article
            key={row.id}
            data-sop-step-order={realIdx + 1}
            className="rounded-2xl border border-border bg-background p-4 sm:p-5"
          >
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                  {realIdx + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {row.type === 'decision' ? 'Decision / keputusan' : row.type === 'terminator' ? 'Awal / akhir proses' : 'Langkah kegiatan'}
                  </h3>
                  {row.type === 'decision' ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">Atur tujuan cabang Ya dan Tidak melalui menu aksi.</p>
                  ) : null}
                </div>
              </div>
              {renderRowActions(row, realIdx)}
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Kegiatan</p>
                <KegiatanCell
                  value={row.kegiatan}
                  onChange={(value) => !readOnly && handleKegiatanChange(realIdx, value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Tipe langkah</p>
                  <TypeCell
                    row={row}
                    index={realIdx}
                    totalRows={prosedurRows.length}
                    stepOrderById={stepOrderById}
                    normalizePosition={!readOnly}
                    onTypeChange={(type, role) => !readOnly && handleTypeChange(realIdx, type, role)}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Pelaksana</p>
                  <ImplementerCell
                    row={row}
                    implementers={implementers}
                    onImplementerChange={(id) => !readOnly && handlePelaksanaChange(realIdx, id, implementers)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Input / kelengkapan</p>
                  <MutuKelengkapanCell
                    value={row.mutu_kelengkapan ?? ''}
                    onChange={(value) => !readOnly && handleMutuKelengkapanChange(realIdx, value)}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Output</p>
                  <OutputCell
                    value={row.output ?? ''}
                    onChange={(value) => !readOnly && handleOutputChange(realIdx, value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Durasi</p>
                  <MutuWaktuCell
                    value={row.mutu_waktu ?? ''}
                    onChange={(amount, unit) => !readOnly && handleMutuWaktuChange(realIdx, amount, unit)}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Keterangan</p>
                  <KeteranganCell
                    value={row.keterangan ?? ''}
                    onChange={(value) => !readOnly && handleKeteranganChange(realIdx, value)}
                  />
                </div>
              </div>

              {row.type === 'decision' ? (
                <div className="rounded-xl bg-muted/45 px-4 py-3 text-sm text-secondary-foreground">
                  <span className="font-medium text-foreground">Routing:</span>{' '}
                  Ya → {row.id_next_step_if_yes ? `Langkah ${stepOrderById[row.id_next_step_if_yes] ?? '-'}` : 'belum diatur'} · Tidak → {row.id_next_step_if_no ? `Langkah ${stepOrderById[row.id_next_step_if_no] ?? '-'}` : 'belum diatur'}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!readOnly ? (
          <Button variant="outline" size="default" onClick={() => guardedAddRow(prosedurRows.length)}>
            + Tambah langkah
          </Button>
        ) : <span />}
        <Button variant="default" size="default" onClick={handleDone}>
          {readOnly ? 'Lanjut ke review' : 'Lanjut ke Informasi Pendukung'}
        </Button>
      </div>

      {!readOnly ? (
        <DecisionStepDialog
          open={isDecisionDialogOpen}
          onOpenChange={setIsDecisionDialogOpen}
          decisionStepIndex={decisionStepIndex}
          prosedurRows={prosedurRows}
          decisionYesId={decisionYesId}
          decisionNoId={decisionNoId}
          setDecisionYesId={setDecisionYesId}
          setDecisionNoId={setDecisionNoId}
          onValidationError={() => {}}
          onSave={(stepIndex, yesId, noId) => {
            setProsedurRows((prev) =>
              prev.map((item, idx) =>
                idx === stepIndex
                  ? {
                      ...item,
                      id_next_step_if_yes: yesId || undefined,
                      id_next_step_if_no: noId || undefined,
                    }
                  : item,
              ),
            )
          }}
        />
      ) : null}
    </section>
  )
}
