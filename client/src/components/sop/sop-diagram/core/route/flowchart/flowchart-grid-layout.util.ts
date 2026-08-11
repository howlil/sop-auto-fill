import type { Point } from '../shared/orthogonalRouter'

/** Garis grid tabel flowchart (swimlane) relatif ke container diagram. */
export interface FlowchartGridLayout {
  horizontalLines: number[]
  verticalLines: number[]
  /** Indeks baris → Y tengah celah antar baris (pipe untuk segmen horizontal). */
  rowGutters: number[]
  minGridX: number
  maxGridX: number
  minGridY: number
  maxGridY: number
}

export const FLOWCHART_GRID_CLEARANCE = 8
export const FLOWCHART_ROW_BORDER_INSET = 16
const NUDGE_STEP = 4

function rangesIntersect(a1: number, a2: number, b1: number, b2: number): boolean {
  const aMin = Math.min(a1, a2)
  const aMax = Math.max(a1, a2)
  const bMin = Math.min(b1, b2)
  const bMax = Math.max(b1, b2)
  return aMin < bMax && bMin < aMax
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((v) => Math.round(v)))].sort((a, b) => a - b)
}

/**
 * Ukur garis border baris/kolom pelaksana dari DOM tabel flowchart.
 */
export function measureFlowchartGridLayout(container: HTMLElement): FlowchartGridLayout | null {
  const containerRect = container.getBoundingClientRect()
  const implCells = container.querySelectorAll('td[data-implementer-id]')
  if (implCells.length === 0) return null

  const rows = new Map<HTMLElement, { tops: number[]; bottoms: number[]; lefts: number[]; rights: number[] }>()

  implCells.forEach((cell) => {
    const tr = cell.closest('tr')
    if (!tr) return
    const rect = cell.getBoundingClientRect()
    const top = rect.top - containerRect.top
    const bottom = rect.bottom - containerRect.top
    const left = rect.left - containerRect.left
    const right = rect.right - containerRect.left
    let row = rows.get(tr)
    if (!row) {
      row = { tops: [], bottoms: [], lefts: [], rights: [] }
      rows.set(tr, row)
    }
    row.tops.push(top)
    row.bottoms.push(bottom)
    row.lefts.push(left)
    row.rights.push(right)
  })

  const rowEntries = [...rows.entries()].sort((a, b) => {
    const aTop = Math.min(...a[1].tops)
    const bTop = Math.min(...b[1].tops)
    return aTop - bTop
  })

  if (rowEntries.length === 0) return null

  const horizontalLines: number[] = []
  const verticalLines: number[] = []
  const rowBounds: { top: number; bottom: number }[] = []

  for (const [, row] of rowEntries) {
    const top = Math.min(...row.tops)
    const bottom = Math.max(...row.bottoms)
    horizontalLines.push(top, bottom)
    rowBounds.push({ top, bottom })
    for (let i = 0; i < row.lefts.length; i += 1) {
      verticalLines.push(row.lefts[i]!, row.rights[i]!)
    }
  }

  const rowGutters: number[] = []
  for (let i = 0; i < rowBounds.length - 1; i += 1) {
    rowGutters.push(findFlowchartRowPipeYFromBounds(rowBounds[i]!, rowBounds[i + 1]!))
  }

  const hUnique = uniqueSorted(horizontalLines)
  const vUnique = uniqueSorted(verticalLines)

  return {
    horizontalLines: hUnique,
    verticalLines: vUnique,
    rowGutters,
    minGridX: vUnique.length > 0 ? vUnique[0]! : 0,
    maxGridX: vUnique.length > 0 ? vUnique[vUnique.length - 1]! : containerRect.width,
    minGridY: hUnique.length > 0 ? hUnique[0]! : 0,
    maxGridY: hUnique.length > 0 ? hUnique[hUnique.length - 1]! : containerRect.height,
  }
}

function findFlowchartRowPipeYFromBounds(
  above: { top: number; bottom: number },
  below: { top: number; bottom: number },
): number {
  const aboveBottom = above.bottom
  const gap = below.top - aboveBottom
  const mid = (aboveBottom + below.top) / 2
  const inset = Math.min(
    FLOWCHART_ROW_BORDER_INSET,
    Math.max(6, Math.floor(gap / 3)),
  )
  return Math.round(Math.max(aboveBottom + inset, Math.min(below.top - inset, mid)))
}

/** Y aman di celah antar dua baris (indeks baris dalam layout). */
export function findFlowchartRowPipeY(
  layout: FlowchartGridLayout,
  aboveRow: number,
  belowRow: number,
): number {
  if (aboveRow < 0 || belowRow >= layout.rowGutters.length + 1) {
    if (layout.horizontalLines.length > 0) {
      if (aboveRow < 0) return layout.horizontalLines[0]! - 20
      const last = layout.horizontalLines[layout.horizontalLines.length - 1]!
      return last + 20
    }
    return 0
  }
  const gutterIndex = belowRow - 1
  if (gutterIndex >= 0 && gutterIndex < layout.rowGutters.length) {
    return layout.rowGutters[gutterIndex]!
  }
  const topLine = layout.horizontalLines[aboveRow * 2 + 1]
  const bottomLine = layout.horizontalLines[(belowRow + 1) * 2]
  if (topLine != null && bottomLine != null) {
    return findFlowchartRowPipeYFromBounds({ top: layout.horizontalLines[aboveRow * 2] ?? topLine - 40, bottom: topLine }, { top: bottomLine, bottom: layout.horizontalLines[(belowRow + 1) * 2 + 1] ?? bottomLine + 40 })
  }
  return layout.minGridY
}

export function pathRunsAlongFlowchartGrid(
  path: Point[],
  layout: FlowchartGridLayout | null | undefined,
  clearance = FLOWCHART_GRID_CLEARANCE,
): boolean {
  if (!layout || path.length < 2) return false
  if (layout.horizontalLines.length === 0 || layout.verticalLines.length === 0) return false

  const horizontalGridLines = new Set(layout.horizontalLines)
  const verticalGridLines = new Set(layout.verticalLines)

  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]!
    const b = path[i + 1]!
    if (a.y === b.y && a.x !== b.x) {
      for (const y of horizontalGridLines) {
        if (Math.abs(a.y - y) <= clearance && rangesIntersect(a.x, b.x, layout.minGridX, layout.maxGridX)) {
          return true
        }
      }
    }
    if (a.x === b.x && a.y !== b.y) {
      for (const x of verticalGridLines) {
        if (Math.abs(a.x - x) <= clearance && rangesIntersect(a.y, b.y, layout.minGridY, layout.maxGridY)) {
          return true
        }
      }
    }
  }

  return false
}

function nearestGridLineOffset(value: number, lines: number[], clearance: number): number {
  let bestOffset = 0
  let bestDist = clearance + 1
  for (const line of lines) {
    const dist = Math.abs(value - line)
    if (dist <= clearance && dist < bestDist) {
      bestDist = dist
      const gap = clearance - dist + NUDGE_STEP
      bestOffset = value <= line ? gap : -gap
    }
  }
  return bestOffset
}

/**
 * Geser segmen yang terlalu dekat garis grid menjauhi border, tetap orthogonal.
 */
export function nudgePathOffGridLines(
  path: Point[],
  layout: FlowchartGridLayout | null | undefined,
  clearance = FLOWCHART_GRID_CLEARANCE,
): Point[] {
  if (!layout || path.length < 2) return path

  const out = path.map((p) => ({ ...p }))
  for (let i = 0; i < out.length - 1; i += 1) {
    const a = out[i]!
    const b = out[i + 1]!
    if (a.y === b.y && a.x !== b.x) {
      const offsetY = nearestGridLineOffset(a.y, layout.horizontalLines, clearance)
      if (offsetY !== 0) {
        a.y += offsetY
        b.y += offsetY
        if (i > 0) out[i - 1] = { ...out[i - 1]!, y: a.y }
        if (i + 2 < out.length) out[i + 2] = { ...out[i + 2]!, y: b.y }
      }
    }
    if (a.x === b.x && a.y !== b.y) {
      const offsetX = nearestGridLineOffset(a.x, layout.verticalLines, clearance)
      if (offsetX !== 0) {
        a.x += offsetX
        b.x += offsetX
        if (i > 0) out[i - 1] = { ...out[i - 1]!, x: a.x }
        if (i + 2 < out.length) out[i + 2] = { ...out[i + 2]!, x: b.x }
      }
    }
  }
  return out
}

const MIN_SPAN_FOR_GUTTER_SNAP = 48

/**
 * Snap segmen horizontal panjang ke row gutter terdekat agar tidak di border baris.
 */
export function snapHorizontalSegmentsToRowGutters(
  path: Point[],
  layout: FlowchartGridLayout | null | undefined,
): Point[] {
  if (!layout || layout.rowGutters.length === 0 || path.length < 2) return path

  const out = path.map((p) => ({ ...p }))
  for (let i = 0; i < out.length - 1; i += 1) {
    const a = out[i]!
    const b = out[i + 1]!
    if (a.y !== b.y || a.x === b.x) continue
    const span = Math.abs(b.x - a.x)
    if (span < MIN_SPAN_FOR_GUTTER_SNAP) continue
    if (pathRunsAlongFlowchartGrid([a, b], layout, FLOWCHART_GRID_CLEARANCE + 2)) {
      let bestGutter = layout.rowGutters[0]!
      let bestDist = Math.abs(a.y - bestGutter)
      for (const gutter of layout.rowGutters) {
        const d = Math.abs(a.y - gutter)
        if (d < bestDist) {
          bestDist = d
          bestGutter = gutter
        }
      }
      const delta = bestGutter - a.y
      a.y += delta
      b.y += delta
      if (i > 0 && out[i - 1]!.x === a.x) out[i - 1] = { ...out[i - 1]!, y: a.y }
      if (i + 2 < out.length && out[i + 2]!.x === b.x) out[i + 2] = { ...out[i + 2]!, y: b.y }
    }
  }
  return out
}
