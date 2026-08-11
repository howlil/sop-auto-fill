import type { SOPStep, FlowchartConnection } from '../../sopDiagramTypes'

/* ── Types ─────────────────────────────────────────────── */

export interface OpcPair {
  letter: string
  fromSeq: number
  toSeq: number
  fromPage: number
  toPage: number
  fromImplId: string
  toImplId: string
  /** Original connection this OPC was split from */
  originalConn: FlowchartConnection
  /** ID DOM unik untuk shape keluar/masuk pada instance diagram aktif. */
  opcOutId?: string
  opcInId?: string
}

export type OpcEndpointVariant = 'in' | 'out'

/** OPC endpoint with its semantic direction, independent from visual row position. */
export interface PositionedOpcEndpoint {
  opc: OpcPair
  variant: OpcEndpointVariant
}

export interface PageConnections {
  /** Connections scoped to each page (index = page number) */
  pages: FlowchartConnection[][]
  /** All cross-page OPC pairs with assigned letters */
  opcPairs: OpcPair[]
}

/* ── Pure helpers ──────────────────────────────────────── */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function splitStepsIntoPages(
  steps: SOPStep[],
  firstPageSteps: number,
  nextPageSteps: number,
): SOPStep[][] {
  if (steps.length === 0) return []
  const pages: SOPStep[][] = []
  pages.push(steps.slice(0, firstPageSteps))
  let i = firstPageSteps
  while (i < steps.length) {
    pages.push(steps.slice(i, i + nextPageSteps))
    i += nextPageSteps
  }
  return pages
}

export function getPageForStep(
  seqNumber: number,
  firstPageSteps: number,
  nextPageSteps: number,
): number {
  if (seqNumber <= firstPageSteps) return 0
  return Math.ceil((seqNumber - firstPageSteps) / nextPageSteps)
}

/**
 * Extract the seq_number from a shape id like "sop-step-3" → 3.
 * Returns -1 if the id doesn't follow the convention.
 */
function seqFromShapeId(id: string, shapeIdPrefix = 'sop-step-'): number {
  const escaped = shapeIdPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = id.match(new RegExp(`^${escaped}(\\d+)$`))
  return m ? Number(m[1]) : -1
}

/**
 * Given all connections and pagination params, split cross-page edges
 * into per-page connection lists with OPC endpoint shapes.
 */
export function splitCrossPageConnections(
  connections: FlowchartConnection[],
  steps: SOPStep[],
  firstPageSteps: number,
  nextPageSteps: number,
  shapeIdPrefix = 'sop-step-',
  domIdPrefix = '',
): PageConnections {
  const totalPages = splitStepsIntoPages(steps, firstPageSteps, nextPageSteps).length
  const pages: FlowchartConnection[][] = Array.from({ length: totalPages }, () => [])
  const opcPairs: OpcPair[] = []

  const stepMap = new Map(steps.map((s) => [s.seq_number, s]))

  for (const conn of connections) {
    const fromSeq = seqFromShapeId(conn.from, shapeIdPrefix)
    const toSeq = seqFromShapeId(conn.to, shapeIdPrefix)
    if (fromSeq < 0 || toSeq < 0) continue

    const fromPage = getPageForStep(fromSeq, firstPageSteps, nextPageSteps)
    const toPage = getPageForStep(toSeq, firstPageSteps, nextPageSteps)

    if (fromPage === toPage) {
      pages[fromPage].push(conn)
      continue
    }

    const fromStep = stepMap.get(fromSeq)
    const toStep = stepMap.get(toSeq)
    const letter = LETTERS[opcPairs.length % LETTERS.length]

    const opcOutId = `${domIdPrefix}opc-out-step-${fromSeq}-to-step-${toSeq}`
    const opcInId = `${domIdPrefix}opc-in-step-${fromSeq}-to-step-${toSeq}`

    pages[fromPage].push({
      ...conn,
      id: `${conn.id}__out`,
      to: opcOutId,
      targetType: 'flowchart-opc',
      toImplementerId: fromStep?.id_implementer ?? conn.fromImplementerId,
    })

    pages[toPage].push({
      ...conn,
      id: `${conn.id}__in`,
      from: opcInId,
      sourceType: 'flowchart-opc',
      fromImplementerId: toStep?.id_implementer ?? conn.toImplementerId,
    })

    opcPairs.push({
      letter,
      fromSeq,
      toSeq,
      fromPage,
      toPage,
      fromImplId: fromStep?.id_implementer ?? '',
      toImplId: toStep?.id_implementer ?? '',
      originalConn: conn,
      opcOutId,
      opcInId,
    })
  }

  return { pages, opcPairs }
}

export function getOpcElementId(opc: OpcPair, variant: 'in' | 'out'): string {
  if (variant === 'in') {
    return opc.opcInId ?? `opc-in-step-${opc.fromSeq}-to-step-${opc.toSeq}`
  }
  return opc.opcOutId ?? `opc-out-step-${opc.fromSeq}-to-step-${opc.toSeq}`
}

/**
 * Collect OPC shapes that belong to a specific page, split into
 * shapes that appear at the top vs bottom of the page.
 *
 * Semantik:
 * - Forward (fromPage < toPage): OPC-out di bottom (alur ke halaman berikutnya),
 *   OPC-in di top (alur diterima dari halaman sebelumnya).
 * - Loop-back (fromPage > toPage): OPC-out di top (alur kembali ke halaman awal),
 *   OPC-in di bottom (alur diterima dari halaman lanjut).
 * Dengan ini, halaman pertama tidak punya OPC-in di top, dan halaman terakhir
 * tidak punya OPC-out di bottom untuk loop-back.
 */
export function getOpcShapesForPage(
  pageIndex: number,
  opcPairs: OpcPair[],
): { top: PositionedOpcEndpoint[]; bottom: PositionedOpcEndpoint[] } {
  const top: PositionedOpcEndpoint[] = []
  const bottom: PositionedOpcEndpoint[] = []

  for (const opc of opcPairs) {
    const isForward = opc.fromPage < opc.toPage
    const isLoopBack = opc.fromPage > opc.toPage

    if (opc.fromPage === pageIndex) {
      // Outgoing from this page
      if (isForward) {
        bottom.push({ opc, variant: 'out' }) // alur ke halaman berikutnya → bottom
      } else if (isLoopBack) {
        top.push({ opc, variant: 'out' }) // alur kembali ke halaman awal → top
      }
    }
    if (opc.toPage === pageIndex) {
      // Incoming to this page
      if (isForward) {
        top.push({ opc, variant: 'in' }) // diterima dari halaman sebelumnya → top
      } else if (isLoopBack) {
        bottom.push({ opc, variant: 'in' }) // diterima dari halaman lanjut → bottom
      }
    }
  }
  // Urutan konsisten agar posisi OPC dan huruf (A,B,C) stabil
  const bySeq = (a: PositionedOpcEndpoint, b: PositionedOpcEndpoint) =>
    a.opc.fromSeq !== b.opc.fromSeq
      ? a.opc.fromSeq - b.opc.fromSeq
      : a.opc.toSeq - b.opc.toSeq
  top.sort(bySeq)
  bottom.sort(bySeq)
  return { top, bottom }
}
