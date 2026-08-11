/**
 * Cell components for DetailSOPProsedurEditor table
 * Extracted to improve readability and testability
 */

import { useEffect, useMemo, useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import type { ProsedurRow } from '@/types/ui/sop'
import { resolveProsedurPelaksanaIdOrFallback } from '@/lib/sop/resolve-prosedur-implementer'

// ==================== Kegiatan Cell ====================

export interface KegiatanCellProps {
  value: string
  onChange: (value: string) => void
}

export function KegiatanCell({ value, onChange }: KegiatanCellProps) {
  return (
    <Textarea
      aria-label="Kegiatan"
      className="text-sm min-h-9 px-2 py-1.5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ==================== Type Cell ====================

type TerminatorRole = 'start' | 'end'

const BASE_TYPE_OPTIONS = [
  { value: 'task', label: 'Task' },
  { value: 'decision', label: 'Decision' },
] as const

const OPT_MULAI = { value: 'terminator-start', label: 'Mulai' } as const
const OPT_SELESAI = { value: 'terminator-end', label: 'Selesai' } as const

/** Aturan tipe per posisi:
 *  - index 0: hanya Mulai
 *  - index terakhir (jika >1): hanya Selesai
 *  - index tengah: hanya Task + Decision */
function typeOptionsForRow(index: number, totalRows: number) {
  if (totalRows <= 1) return [OPT_MULAI]
  if (index === 0) return [OPT_MULAI]
  if (index === totalRows - 1) return [OPT_SELESAI]
  return BASE_TYPE_OPTIONS
}

function isFirstRow(index: number): boolean {
  return index === 0
}

function isLastRow(index: number, totalRows: number): boolean {
  return totalRows > 1 && index === totalRows - 1
}

export interface TypeCellProps {
  row: ProsedurRow
  /** Indeks baris global (0-based) dalam seluruh prosedur. */
  index: number
  totalRows: number
  /** Peta rowId -> urutan tampilan (1-based) untuk label decision. */
  stepOrderById: Record<string, number>
  onTypeChange: (
    type: ProsedurRow['type'],
    terminatorRole?: TerminatorRole,
  ) => void
  normalizePosition?: boolean
}

export function TypeCell({
  row,
  index,
  totalRows,
  stepOrderById,
  onTypeChange,
  normalizePosition = true,
}: TypeCellProps) {
  const onTypeChangeRef = useRef(onTypeChange)
  onTypeChangeRef.current = onTypeChange

  const isDecision = row.type === 'decision'
  const yesTargetOrder = row.id_next_step_if_yes
    ? stepOrderById[row.id_next_step_if_yes]
    : undefined
  const noTargetOrder = row.id_next_step_if_no
    ? stepOrderById[row.id_next_step_if_no]
    : undefined
  const hasDecisionTarget =
    row.id_next_step_if_yes !== undefined || row.id_next_step_if_no !== undefined

  const selectOptions = useMemo(
    () => typeOptionsForRow(index, totalRows),
    [index, totalRows],
  )

  useEffect(() => {
    if (!normalizePosition) return
    // Normalisasi otomatis agar data selalu sesuai aturan posisi baris.
    if (isFirstRow(index)) {
      if (row.type !== 'terminator' || row.terminatorRole !== 'start') {
        onTypeChangeRef.current('terminator', 'start')
      }
      return
    }
    if (isLastRow(index, totalRows)) {
      if (row.type !== 'terminator' || row.terminatorRole !== 'end') {
        onTypeChangeRef.current('terminator', 'end')
      }
      return
    }
    // Baris tengah tidak boleh terminator.
    if (row.type === 'terminator') {
      onTypeChangeRef.current('task')
    }
  }, [row.type, row.terminatorRole, index, totalRows, normalizePosition])

  const displayValue =
    isFirstRow(index)
      ? 'terminator-start'
      : isLastRow(index, totalRows)
        ? 'terminator-end'
        : (row.type === 'decision' ? 'decision' : 'task')

  const handleChange = (value: string) => {
    if (value === 'terminator-start') {
      onTypeChange('terminator', 'start')
      return
    }
    if (value === 'terminator-end') {
      onTypeChange('terminator', 'end')
      return
    }
    onTypeChange(value as ProsedurRow['type'])
  }

  return (
    <div className="space-y-1">
      <select
        aria-label="Tipe langkah"
        className="h-9 w-full rounded-control border border-border-strong px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
      >
        {selectOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {isDecision && (
        <p className="text-[10px] text-muted-foreground">
          {!hasDecisionTarget
            ? 'Belum diatur cabang Ya/Tidak.'
            : [
                row.id_next_step_if_yes
                  ? `Ya -> urutan ${yesTargetOrder ?? '?'}` 
                  : null,
                row.id_next_step_if_no
                  ? `Tidak -> urutan ${noTargetOrder ?? '?'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' • ')}
        </p>
      )}
    </div>
  )
}

// ==================== Implementer Cell ====================

export interface ImplementerCellProps {
  row: ProsedurRow
  implementers: { id: string; name: string }[]
  onImplementerChange: (implementerId: string) => void
}

export function ImplementerCell({ row, implementers, onImplementerChange }: ImplementerCellProps) {
  const selectedId = resolveProsedurPelaksanaIdOrFallback(row, implementers[0]?.id ?? '')

  return (
    <select
      aria-label="Pelaksana"
      className="h-9 w-full rounded-control border border-border-strong px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
      value={selectedId}
      onChange={(e) => onImplementerChange(e.target.value)}
    >
      {implementers.map((impl) => (
        <option key={impl.id} value={impl.id}>
          {impl.name}
        </option>
      ))}
    </select>
  )
}

// ==================== Mutu Kelengkapan Cell ====================

export interface MutuKelengkapanCellProps {
  value: string
  onChange: (value: string) => void
}

export function MutuKelengkapanCell({ value, onChange }: MutuKelengkapanCellProps) {
  return (
    <Textarea
      aria-label="Kelengkapan"
      className="text-sm min-h-9 px-2 py-1.5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ==================== Mutu Waktu Cell ====================

export interface MutuWaktuCellProps {
  value: string
  onChange: (amount: string, unit: string) => void
}

export function MutuWaktuCell({ value, onChange }: MutuWaktuCellProps) {
  const match = (value || '').match(/^(\d+)\s*(\w+)?/i)
  const amount = match ? match[1] : ''
  const rawUnit = match && match[2] ? match[2].toLowerCase() : ''
  
  const unit = rawUnit.startsWith('menit')
    ? 'm'
    : rawUnit.startsWith('jam')
      ? 'h'
      : rawUnit.startsWith('hari')
        ? 'd'
        : rawUnit.startsWith('minggu')
          ? 'w'
          : rawUnit.startsWith('bulan')
            ? 'mo'
            : 'm'

  return (
    <div className="flex min-w-0 items-stretch rounded-md border border-border-strong bg-surface">
      <Input
        aria-label="Jumlah waktu"
        type="number"
        min={0}
        inputMode="numeric"
        placeholder="0"
        className="h-9 min-h-9 w-[3.5rem] min-w-[3.5rem] shrink-0 rounded-none rounded-l-control border-0 border-r border-border px-2 py-1.5 text-center text-sm tabular-nums focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-primary"
        value={amount}
        onChange={(e) => onChange(e.target.value, unit)}
      />
      <select
        aria-label="Satuan waktu"
        className="h-9 min-h-9 min-w-[5rem] flex-1 rounded-none rounded-r-control border-0 bg-surface-subtle/80 py-0 pl-1.5 pr-7 text-sm outline-none focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-primary"
        value={unit}
        onChange={(e) => onChange(amount, e.target.value)}
      >
        <option value="m">Menit</option>
        <option value="h">Jam</option>
        <option value="d">Hari</option>
        <option value="w">Minggu</option>
        <option value="mo">Bulan</option>
      </select>
    </div>
  )
}

// ==================== Output Cell ====================

export interface OutputCellProps {
  value: string
  onChange: (value: string) => void
}

export function OutputCell({ value, onChange }: OutputCellProps) {
  return (
    <Textarea
      aria-label="Output"
      className="text-sm min-h-9 px-2 py-1.5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ==================== Keterangan Cell ====================

export interface KeteranganCellProps {
  value: string
  onChange: (value: string) => void
}

export function KeteranganCell({ value, onChange }: KeteranganCellProps) {
  return (
    <Textarea
      aria-label="Keterangan"
      className="text-sm min-h-9 px-2 py-1.5"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
