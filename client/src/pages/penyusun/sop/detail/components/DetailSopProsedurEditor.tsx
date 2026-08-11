import { MoreHorizontal, Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/data-table'
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
}

export function DetailSOPProsedurEditor({
  prosedurRows,
  setProsedurRows,
  implementers,
  onDone,
}: DetailSOPProsedurEditorProps) {
  const { showToast } = useToast()
  const {
    // Dialog state
    isDecisionDialogOpen,
    setIsDecisionDialogOpen,
    decisionStepIndex,
    decisionYesId,
    decisionNoId,
    setDecisionYesId,
    setDecisionNoId,
    
    // Row operations
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
    const validation = validateProsedurRows(prosedurRows, implementers.length)
    if (!validation.valid) {
      showToast(formatProsedurValidationMessage(validation.errors), 'error')
      return
    }
    onDone()
  }

  const renderRowActions = (row: ProsedurRow, realIdx: number) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0 text-secondary-foreground hover:bg-surface-subtle hover:text-foreground"
          aria-label={`Aksi langkah ${realIdx + 1}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
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
          <span className="mr-1.5 text-blue-600" aria-hidden>+</span>
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

  return (
    <div className="w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden mb-3">
        <p className="text-xs font-semibold text-foreground">Edit langkah / prosedur</p>
      </div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">No akan otomatis mengikuti urutan baris.</p>
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <Table.Table className="min-w-[1000px]">
          <thead className="bg-surface-subtle border-b border-border">
            <Table.HeadRow>
              <Table.Th className="px-2 py-2 w-10 min-w-[40px]">No</Table.Th>
              <Table.Th className="px-2 py-2 min-w-[200px]">Kegiatan</Table.Th>
              <Table.Th className="px-2 py-2 min-w-[120px]">Tipe</Table.Th>
              <Table.Th className="px-2 py-2 min-w-[140px]">Pelaksana</Table.Th>
              <Table.Th className="px-2 py-2 min-w-[140px]">Kelengkapan</Table.Th>
              <Table.Th className="px-2 py-2 min-w-[120px]">Waktu</Table.Th>
              <Table.Th className="px-2 py-2 min-w-[140px]">Output</Table.Th>
              <Table.Th className="px-2 py-2 min-w-[160px]">Keterangan</Table.Th>
              <Table.ActionTh className="w-12 min-w-[48px] px-1 py-2">Aksi</Table.ActionTh>
            </Table.HeadRow>
          </thead>
          <tbody>
            {prosedurRows.map((row, realIdx) => {
              return (
                <Table.BodyRow key={row.id} className="align-top">
                  <Table.Td className="px-2 py-2 text-center align-middle">{realIdx + 1}</Table.Td>
                  <Table.Td className="px-2 py-2">
                    <KegiatanCell
                      value={row.kegiatan}
                      onChange={(value) => handleKegiatanChange(realIdx, value)}
                    />
                  </Table.Td>
                  <Table.Td className="px-2 py-2">
                    <TypeCell
                      row={row}
                      index={realIdx}
                      totalRows={prosedurRows.length}
                      stepOrderById={stepOrderById}
                      onTypeChange={(type, role) => handleTypeChange(realIdx, type, role)}
                    />
                  </Table.Td>
                  <Table.Td className="px-2 py-2">
                    <ImplementerCell
                      row={row}
                      implementers={implementers}
                      onImplementerChange={(id) => handlePelaksanaChange(realIdx, id, implementers)}
                    />
                  </Table.Td>
                  <Table.Td className="px-2 py-2">
                    <MutuKelengkapanCell
                      value={row.mutu_kelengkapan ?? ''}
                      onChange={(value) => handleMutuKelengkapanChange(realIdx, value)}
                    />
                  </Table.Td>
                  <Table.Td className="px-2 py-2">
                    <MutuWaktuCell
                      value={row.mutu_waktu ?? ''}
                      onChange={(amount, unit) => handleMutuWaktuChange(realIdx, amount, unit)}
                    />
                  </Table.Td>
                  <Table.Td className="px-2 py-2">
                    <OutputCell
                      value={row.output ?? ''}
                      onChange={(value) => handleOutputChange(realIdx, value)}
                    />
                  </Table.Td>
                  <Table.Td className="px-2 py-2">
                    <KeteranganCell
                      value={row.keterangan ?? ''}
                      onChange={(value) => handleKeteranganChange(realIdx, value)}
                    />
                  </Table.Td>
                  <Table.ActionTd className="w-12 min-w-[48px] px-1 py-2">
                    {renderRowActions(row, realIdx)}
                  </Table.ActionTd>
                </Table.BodyRow>
              )
            })}
          </tbody>
        </Table.Table>
      </div>
      <div className="space-y-3 md:hidden" aria-label="Editor langkah prosedur">
        {prosedurRows.map((row, realIdx) => (
          <section key={row.id} className="rounded-xl border border-border bg-surface p-4 shadow-surface">
            <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3">
              <h3 className="text-sm font-semibold text-foreground">Langkah {realIdx + 1}</h3>
              {renderRowActions(row, realIdx)}
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-secondary-foreground">Kegiatan</p>
                <KegiatanCell
                  value={row.kegiatan}
                  onChange={(value) => handleKegiatanChange(realIdx, value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-secondary-foreground">Tipe</p>
                  <TypeCell
                    row={row}
                    index={realIdx}
                    totalRows={prosedurRows.length}
                    stepOrderById={stepOrderById}
                    normalizePosition={false}
                    onTypeChange={(type, role) => handleTypeChange(realIdx, type, role)}
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-secondary-foreground">Pelaksana</p>
                  <ImplementerCell
                    row={row}
                    implementers={implementers}
                    onImplementerChange={(id) => handlePelaksanaChange(realIdx, id, implementers)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-secondary-foreground">Kelengkapan</p>
                <MutuKelengkapanCell
                  value={row.mutu_kelengkapan ?? ''}
                  onChange={(value) => handleMutuKelengkapanChange(realIdx, value)}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-secondary-foreground">Waktu</p>
                <MutuWaktuCell
                  value={row.mutu_waktu ?? ''}
                  onChange={(amount, unit) => handleMutuWaktuChange(realIdx, amount, unit)}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-secondary-foreground">Output</p>
                <OutputCell
                  value={row.output ?? ''}
                  onChange={(value) => handleOutputChange(realIdx, value)}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-secondary-foreground">Keterangan</p>
                <KeteranganCell
                  value={row.keterangan ?? ''}
                  onChange={(value) => handleKeteranganChange(realIdx, value)}
                />
              </div>
            </div>
          </section>
        ))}
      </div>
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          size="default"
          onClick={() => guardedAddRow(prosedurRows.length)}
        >
          Tambah langkah
        </Button>
        <Button
          variant="default"
          size="default"
          onClick={handleDone}
        >
          Selesai edit
        </Button>
      </div>

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
            prev.map((row, idx) =>
              idx === stepIndex
                ? {
                    ...row,
                    id_next_step_if_yes: yesId || undefined,
                    id_next_step_if_no: noId || undefined,
                  }
                : row
            )
          )
        }}
      />
    </div>
  )
}
