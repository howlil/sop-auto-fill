import {
  getOpcElementId,
  type OpcEndpointVariant,
  type OpcPair,
  type PositionedOpcEndpoint,
} from './flowchartPagination'
import type {
  FlowchartPelaksanaBoundsRect,
  ImplementerColumnBoundsMap,
} from './flowchart-column-bounds.util'

/** Lebar/tinggi SVG OffPageConnector — harus selaras dengan komponen shape. */
export const OPC_CONNECTOR_WIDTH_PX = 50
export const OPC_CONNECTOR_HEIGHT_PX = 60
export const OPC_CONNECTOR_STACK_GAP_PX = 8

export type OpcPlacementVariant = OpcEndpointVariant

/** Lebar kolom tabel flowchart (persen, selaras dengan `<colgroup>`). */
export interface FlowchartTableColumnPercents {
  noColPercent: number
  kegiatanPercent: number
  pelaksanaColPercent: number
}

export interface OpcPlacement {
  opc: OpcPair
  elementId: string
  implementerId: string
  /** Pusat kolom dalam px relatif ke `#main-sop-area-*` (prioritas utama). */
  centerXPx: number | null
  /** Pusat kolom dalam % lebar container (fallback sebelum DOM diukur). */
  centerPercent: number
  stackIndex: number
}

/** Implementer yang menentukan kolom: OPC-in → penerima (`to`), OPC-out → pengirim (`from`). */
export function resolveOpcImplementerId(
  opc: OpcPair,
  variant: OpcPlacementVariant,
): string {
  return variant === 'in' ? opc.toImplId : opc.fromImplId
}

export function buildFlowchartTableColumnPercents(
  kegiatanPercent: number,
  pelaksanaColPercent: number,
): FlowchartTableColumnPercents {
  return {
    noColPercent: 5,
    kegiatanPercent,
    pelaksanaColPercent,
  }
}

/**
 * Pusat horizontal kolom pelaksana ke-i (0-based) dari layout persen tabel.
 *
 * Rumus: X_center% = W_no + W_kegiatan + W_pelaksana × (i + ½)
 */
export function computePelaksanaColumnCenterPercent(
  implementerIndex: number,
  columns: FlowchartTableColumnPercents,
): number {
  const { noColPercent, kegiatanPercent, pelaksanaColPercent } = columns
  return noColPercent + kegiatanPercent + pelaksanaColPercent * (implementerIndex + 0.5)
}

/** Pusat kolom dari bounds DOM (px, relatif container diagram). */
export function computeColumnCenterX(bounds: FlowchartPelaksanaBoundsRect): number {
  return (bounds.left + bounds.right) / 2
}

/**
 * Konversi pusat kolom → `left` CSS agar pusat shape = centerX.
 * X_pos = X_center − (W_connector / 2)
 */
export function centerXToLeftPx(centerX: number, connectorWidth = OPC_CONNECTOR_WIDTH_PX): number {
  return centerX - connectorWidth / 2
}

export function centerPercentToLeftCss(centerPercent: number): string {
  return `${centerPercent}%`
}

/** Offset vertikal tumpuk beberapa OPC di kolom yang sama. */
export function computeOpcStackTopPx(stackIndex: number): number {
  return stackIndex * (OPC_CONNECTOR_HEIGHT_PX + OPC_CONNECTOR_STACK_GAP_PX)
}

function resolveImplementerIndex(
  implementerId: string,
  implementers: ReadonlyArray<{ id: string }>,
): number {
  if (!implementerId) return 0
  const idx = implementers.findIndex((impl) => impl.id === implementerId)
  return idx >= 0 ? idx : 0
}

function resolveColumnCenter(
  implementerId: string,
  implementerIndex: number,
  columnBounds: ImplementerColumnBoundsMap | null | undefined,
  tableColumns: FlowchartTableColumnPercents,
): { centerXPx: number | null; centerPercent: number } {
  const centerPercent = computePelaksanaColumnCenterPercent(implementerIndex, tableColumns)
  const bounds =
    implementerId && columnBounds?.[implementerId]
      ? columnBounds[implementerId]
      : undefined
  if (bounds && bounds.right > bounds.left) {
    return { centerXPx: computeColumnCenterX(bounds), centerPercent }
  }
  return { centerXPx: null, centerPercent }
}

/**
 * Menata OPC per kolom pelaksana: satu sumbu X di tengah kolom, tumpuk vertikal bila >1.
 */
export function layoutOpcPlacements(
  opcs: ReadonlyArray<OpcPair>,
  variant: OpcPlacementVariant,
  options: {
    implementers: ReadonlyArray<{ id: string }>
    columnBounds?: ImplementerColumnBoundsMap | null
    tableColumns: FlowchartTableColumnPercents
  },
): OpcPlacement[] {
  return layoutOpcEndpointPlacements(
    opcs.map((opc) => ({ opc, variant })),
    options,
  )
}

/**
 * Layout endpoints in one visual row. A row can contain semantic `in` and `out`
 * endpoints together when forward edges and loop-backs meet on the same page.
 */
export function layoutOpcEndpointPlacements(
  endpoints: ReadonlyArray<PositionedOpcEndpoint>,
  options: {
    implementers: ReadonlyArray<{ id: string }>
    columnBounds?: ImplementerColumnBoundsMap | null
    tableColumns: FlowchartTableColumnPercents
  },
): OpcPlacement[] {
  const { implementers, columnBounds, tableColumns } = options
  const byColumn = new Map<string, PositionedOpcEndpoint[]>()
  for (const endpoint of endpoints) {
    const { opc, variant } = endpoint
    const implId = resolveOpcImplementerId(opc, variant)
    const key = implId || '__default__'
    const list = byColumn.get(key) ?? []
    list.push(endpoint)
    byColumn.set(key, list)
  }
  const placements: OpcPlacement[] = []
  for (const [implKey, group] of byColumn) {
    const implementerId = implKey === '__default__' ? '' : implKey
    const implIndex = resolveImplementerIndex(implementerId, implementers)
    const { centerXPx, centerPercent } = resolveColumnCenter(
      implementerId,
      implIndex,
      columnBounds,
      tableColumns,
    )
    group
      .slice()
      .sort((a, b) =>
        a.opc.fromSeq !== b.opc.fromSeq
          ? a.opc.fromSeq - b.opc.fromSeq
          : a.opc.toSeq - b.opc.toSeq,
      )
      .forEach(({ opc, variant }, stackIndex) => {
        placements.push({
          opc,
          elementId: getOpcElementId(opc, variant),
          implementerId,
          centerXPx,
          centerPercent,
          stackIndex,
        })
      })
  }
  placements.sort((a, b) => {
    const colA = a.centerXPx ?? a.centerPercent
    const colB = b.centerXPx ?? b.centerPercent
    if (colA !== colB) return colA - colB
    return a.stackIndex - b.stackIndex
  })
  return placements
}
