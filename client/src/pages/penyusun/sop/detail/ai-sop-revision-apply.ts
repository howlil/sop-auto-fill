import type { SopAiRevisionResponse } from '@/api/workspace-sops'
import type { ProsedurRow, SOPDetailMetadata } from '@/types/ui/sop'

export interface AiRevisionEditorState {
  metadata: SOPDetailMetadata
  prosedurRows: ProsedurRow[]
}

export type ApplyAiRevisionResult =
  | { ok: true; metadata: SOPDetailMetadata; prosedurRows: ProsedurRow[] }
  | { ok: false; reason: 'STALE_TARGET' | 'TARGET_NOT_FOUND' }

function asWarningArray(value: SOPDetailMetadata['warning']): string[] {
  if (Array.isArray(value)) return [...value]
  if (typeof value === 'string' && value.trim().length > 0) return [value]
  return []
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = (value ?? '').trim()
    if (normalized.length > 0) return normalized
  }
  return ''
}

function matchesBefore(current: string, before: string): boolean {
  return current.trim() === before.trim()
}

export function applyAiRevisionToEditor(
  state: AiRevisionEditorState,
  suggestion: SopAiRevisionResponse['suggestion'],
): ApplyAiRevisionResult {
  const { target, before, after } = suggestion

  if (target.kind === 'HEADER') {
    const current = (state.metadata.judul ?? state.metadata.nama ?? '').trim()
    if (!matchesBefore(current, before)) return { ok: false, reason: 'STALE_TARGET' }
    return {
      ok: true,
      metadata: { ...state.metadata, judul: after },
      prosedurRows: state.prosedurRows,
    }
  }

  if (target.kind === 'PERINGATAN') {
    const warning = asWarningArray(state.metadata.warning)
    const current = warning[target.itemIndex]
    if (current === undefined) return { ok: false, reason: 'TARGET_NOT_FOUND' }
    if (!matchesBefore(current, before)) return { ok: false, reason: 'STALE_TARGET' }
    const nextWarning = [...warning]
    nextWarning[target.itemIndex] = after
    return {
      ok: true,
      metadata: { ...state.metadata, warning: nextWarning },
      prosedurRows: state.prosedurRows,
    }
  }

  const rowIndex = state.prosedurRows.findIndex((row) => row.urutan === target.stepOrder)
  if (rowIndex < 0) return { ok: false, reason: 'TARGET_NOT_FOUND' }
  const row = state.prosedurRows[rowIndex]

  let current = ''
  switch (target.field) {
    case 'KEGIATAN':
      current = (row.kegiatan ?? '').trim()
      break
    case 'KELENGKAPAN':
      current = firstNonEmpty(row.mutu_kelengkapan, row.kelengkapan)
      break
    case 'KELUARAN':
      current = firstNonEmpty(row.output, row.keluaran)
      break
    case 'KETERANGAN':
      current = (row.keterangan ?? '').trim()
      break
  }

  if (!matchesBefore(current, before)) return { ok: false, reason: 'STALE_TARGET' }

  let nextRow: ProsedurRow
  switch (target.field) {
    case 'KEGIATAN':
      nextRow = { ...row, kegiatan: after }
      break
    case 'KELENGKAPAN':
      nextRow = { ...row, kelengkapan: after, mutu_kelengkapan: after }
      break
    case 'KELUARAN':
      nextRow = { ...row, keluaran: after, output: after }
      break
    case 'KETERANGAN':
      nextRow = { ...row, keterangan: after }
      break
  }

  const nextRows = [...state.prosedurRows]
  nextRows[rowIndex] = nextRow
  return {
    ok: true,
    metadata: state.metadata,
    prosedurRows: nextRows,
  }
}
