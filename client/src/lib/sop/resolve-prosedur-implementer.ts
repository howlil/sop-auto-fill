import type { ProsedurRow } from '@/types/ui/sop'

export function resolvePelaksanaMappingId(
  mapping: Record<string, string> | undefined,
): string {
  if (!mapping) return ''
  const id = Object.keys(mapping).find((key) => (mapping[key] ?? '').trim().length > 0)
  return id?.trim() ?? ''
}

export function resolveProsedurPelaksanaId(row: ProsedurRow): string {
  const fromField = typeof row.pelaksana === 'string' ? row.pelaksana.trim() : ''
  if (fromField.length > 0) return fromField
  return resolvePelaksanaMappingId(row.pelaksanaMapping)
}

export function resolveProsedurPelaksanaIdOrFallback(
  row: ProsedurRow,
  fallbackId = '',
): string {
  return resolveProsedurPelaksanaId(row) || fallbackId
}
