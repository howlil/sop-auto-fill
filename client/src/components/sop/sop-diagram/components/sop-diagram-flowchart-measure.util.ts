import {
  measureFlowchartGridLayout,
  type FlowchartGridLayout,
} from '../core/route/flowchart/flowchart-grid-layout.util'
import {
  measureFlowchartImplementerColumnBounds,
} from '../core/route/flowchart/flowchart-column-bounds.util'
import type { ImplementerColumnBoundsMap } from '../core/route/flowchart/flowchart-column-bounds.util'
import type { FlowchartAreaIdResolver } from '../core/route/flowchart/flowchart-column-bounds.util'

export type { ImplementerColumnBoundsMap } from '../core/route/flowchart/flowchart-column-bounds.util'

export type FlowchartPelaksanaBoundsRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export function sopDiagramAreaId(pageIndex: number): string {
  return `main-sop-area-${pageIndex}`
}

function buildPelaksanaBoundsSig(
  boundsByPage: Record<number, FlowchartPelaksanaBoundsRect>,
): string {
  return Object.entries(boundsByPage)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([pi, bounds]) => `${pi}:${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}`)
    .join('|')
}

/** Ukur koridor pelaksana per halaman; kembalikan bounds + signature untuk gate layoutMeasured. */
export function measureFlowchartPelaksanaBounds(
  pageCount: number,
  boundsStore: Record<number, FlowchartPelaksanaBoundsRect>,
  areaIdForPage: FlowchartAreaIdResolver = sopDiagramAreaId,
): { sig: string; domReady: boolean } {
  const PAD_LEFT = 8
  const PAD_RIGHT = 8
  const PAD_TOP = 8
  const PAD_BOTTOM = 12
  let domReady = false
  for (const pageIndex of Object.keys(boundsStore)) {
    if (Number(pageIndex) >= pageCount) delete boundsStore[Number(pageIndex)]
  }
  for (let pi = 0; pi < pageCount; pi += 1) {
    const container = document.getElementById(areaIdForPage(pi))
    if (!container) continue
    domReady = true
    const containerRect = container.getBoundingClientRect()
    const implCells = container.querySelectorAll('td[data-implementer-id]')
    let minLeft = Infinity
    let maxRight = -Infinity
    let minTop = Infinity
    let maxBottom = -Infinity
    implCells.forEach((cell) => {
      const rect = cell.getBoundingClientRect()
      minLeft = Math.min(minLeft, rect.left - containerRect.left)
      maxRight = Math.max(maxRight, rect.right - containerRect.left)
      minTop = Math.min(minTop, rect.top - containerRect.top)
      maxBottom = Math.max(maxBottom, rect.bottom - containerRect.top)
    })
    const opcEls = container.querySelectorAll('[data-flowchart-opc]')
    opcEls.forEach((el) => {
      const rect = el.getBoundingClientRect()
      minTop = Math.min(minTop, rect.top - containerRect.top)
      maxBottom = Math.max(maxBottom, rect.bottom - containerRect.top)
    })
    if (minLeft === Infinity) minLeft = 0
    if (maxRight === -Infinity) maxRight = containerRect.width
    boundsStore[pi] = {
      left: Math.max(0, minLeft + PAD_LEFT),
      top: Math.max(0, minTop + PAD_TOP),
      right: maxRight - PAD_RIGHT,
      bottom: maxBottom + PAD_BOTTOM,
    }
  }
  return { sig: buildPelaksanaBoundsSig(boundsStore), domReady }
}

/** Ukur bounds per kolom implementer; gabung signature ke sig pelaksana. */
export function measureFlowchartLayoutWithColumns(
  pageCount: number,
  boundsStore: Record<number, FlowchartPelaksanaBoundsRect>,
  columnStore: Record<number, ImplementerColumnBoundsMap>,
  areaIdForPage: FlowchartAreaIdResolver = sopDiagramAreaId,
  gridStore?: Record<number, FlowchartGridLayout | null>,
): { sig: string; domReady: boolean } {
  const base = measureFlowchartPelaksanaBounds(pageCount, boundsStore, areaIdForPage)
  const colSig = measureFlowchartImplementerColumnBounds(pageCount, columnStore, areaIdForPage)
  const gridSig = gridStore
    ? measureFlowchartGridLayouts(pageCount, gridStore, areaIdForPage)
    : ''
  return { sig: `${base.sig}::${colSig}::${gridSig}`, domReady: base.domReady }
}

/** Ukur garis grid pelaksana per halaman (untuk routing menjauhi border tabel). */
export function measureFlowchartGridLayouts(
  pageCount: number,
  gridStore: Record<number, FlowchartGridLayout | null>,
  areaIdForPage: FlowchartAreaIdResolver = sopDiagramAreaId,
): string {
  for (const pageIndex of Object.keys(gridStore)) {
    if (Number(pageIndex) >= pageCount) delete gridStore[Number(pageIndex)]
  }
  for (let pi = 0; pi < pageCount; pi += 1) {
    const container = document.getElementById(areaIdForPage(pi))
    if (!container) {
      gridStore[pi] = null
      continue
    }
    gridStore[pi] = measureFlowchartGridLayout(container)
  }
  return Object.entries(gridStore)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([pageIndex, layout]) => {
      if (!layout) return `${pageIndex}:none`
      return `${pageIndex}:${layout.horizontalLines.join(',')}|${layout.verticalLines.join(',')}|${layout.rowGutters.join(',')}`
    })
    .join(';')
}

export function applyFlowchartPelaksanaFallbackBounds(
  pageCount: number,
  boundsStore: Record<number, FlowchartPelaksanaBoundsRect>,
  areaIdForPage: FlowchartAreaIdResolver = sopDiagramAreaId,
): string {
  const PAD_LEFT = 8
  const PAD_RIGHT = 8
  const PAD_TOP = 8
  const PAD_BOTTOM = 12
  for (let pi = 0; pi < pageCount; pi += 1) {
    const container = document.getElementById(areaIdForPage(pi))
    if (!container) continue
    const containerRect = container.getBoundingClientRect()
    boundsStore[pi] = {
      left: PAD_LEFT,
      top: PAD_TOP,
      right: Math.max(PAD_LEFT, containerRect.width - PAD_RIGHT),
      bottom: Math.max(PAD_TOP, containerRect.height - PAD_BOTTOM),
    }
  }
  return buildPelaksanaBoundsSig(boundsStore)
}

export function hasFlowchartMeasureDom(
  pageCount: number,
  areaIdForPage: FlowchartAreaIdResolver = sopDiagramAreaId,
): boolean {
  for (let pi = 0; pi < pageCount; pi += 1) {
    const container = document.getElementById(areaIdForPage(pi))
    if (!container) continue
    if (container.querySelector('td[data-implementer-id]')) return true
  }
  return false
}
