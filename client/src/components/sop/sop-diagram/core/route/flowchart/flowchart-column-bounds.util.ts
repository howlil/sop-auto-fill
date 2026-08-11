
export type FlowchartPelaksanaBoundsRect = {
  left: number
  top: number
  right: number
  bottom: number
}

export type ImplementerColumnBoundsMap = Record<string, FlowchartPelaksanaBoundsRect>

function sopDiagramAreaId(pageIndex: number): string {
  return `main-sop-area-${pageIndex}`
}

export type FlowchartAreaIdResolver = (pageIndex: number) => string

const COL_PAD_LEFT = 6
const COL_PAD_RIGHT = 6
const COL_PAD_TOP = 4
const COL_PAD_BOTTOM = 8

function buildColumnBoundsSig(
  store: Record<number, ImplementerColumnBoundsMap>,
): string {
  return Object.entries(store)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([pi, cols]) => {
      const parts = Object.entries(cols)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, b]) => `${id}:${b.left},${b.top},${b.right},${b.bottom}`)
      return `${pi}=${parts.join(';')}`
    })
    .join('|')
}

/** Ukur bounds per kolom `td[data-implementer-id]` relatif ke container halaman. */
export function measureFlowchartImplementerColumnBounds(
  pageCount: number,
  store: Record<number, ImplementerColumnBoundsMap>,
  areaIdForPage: FlowchartAreaIdResolver = sopDiagramAreaId,
): string {
  for (const pageIndex of Object.keys(store)) {
    if (Number(pageIndex) >= pageCount) delete store[Number(pageIndex)]
  }
  for (let pi = 0; pi < pageCount; pi += 1) {
    const container = document.getElementById(areaIdForPage(pi))
    const cols: ImplementerColumnBoundsMap = {}
    if (!container) {
      store[pi] = cols
      continue
    }
    const containerRect = container.getBoundingClientRect()
    const implCells = container.querySelectorAll('td[data-implementer-id]')
    implCells.forEach((cell) => {
      const implId = cell.getAttribute('data-implementer-id')
      if (!implId) return
      const rect = cell.getBoundingClientRect()
      const left = rect.left - containerRect.left
      const right = rect.right - containerRect.left
      const top = rect.top - containerRect.top
      const bottom = rect.bottom - containerRect.top
      const prev = cols[implId]
      if (!prev) {
        cols[implId] = {
          left,
          top,
          right,
          bottom,
        }
        return
      }
      cols[implId] = {
        left: Math.min(prev.left, left),
        top: Math.min(prev.top, top),
        right: Math.max(prev.right, right),
        bottom: Math.max(prev.bottom, bottom),
      }
    })
    for (const id of Object.keys(cols)) {
      const b = cols[id]!
      cols[id] = {
        left: Math.max(0, b.left + COL_PAD_LEFT),
        top: Math.max(0, b.top + COL_PAD_TOP),
        right: b.right - COL_PAD_RIGHT,
        bottom: b.bottom - COL_PAD_BOTTOM,
      }
    }
    store[pi] = cols
  }
  return buildColumnBoundsSig(store)
}

/** Kolom yang memuat titik X shape (pusat atau tepi). */
export function resolveColumnBoundsForShapeX(
  shapeCenterX: number,
  columns: ImplementerColumnBoundsMap | null | undefined,
  pelaksanaFallback: FlowchartPelaksanaBoundsRect | null | undefined,
): FlowchartPelaksanaBoundsRect | null {
  if (columns && Object.keys(columns).length > 0) {
    let best: FlowchartPelaksanaBoundsRect | null = null
    let bestOverlap = -1
    for (const bounds of Object.values(columns)) {
      if (shapeCenterX >= bounds.left && shapeCenterX <= bounds.right) {
        return bounds
      }
      const overlap =
        Math.min(bounds.right, shapeCenterX + 40) - Math.max(bounds.left, shapeCenterX - 40)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = bounds
      }
    }
    if (best) return best
  }
  return pelaksanaFallback ?? null
}

export function columnBoundsToCorridor(
  bounds: FlowchartPelaksanaBoundsRect,
): { left: number; top: number; right: number; bottom: number } {
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom,
  }
}

/** Pipa vertikal di dalam satu kolom pelaksana (bukan tepi swimlane global). */
export function pickColumnPipeX(
  side: 'left' | 'right',
  column: FlowchartPelaksanaBoundsRect,
  slotIndex: number,
  stepPx: number,
): number {
  const inset = 10
  if (side === 'left') {
    return Math.round(column.left + inset + slotIndex * stepPx)
  }
  return Math.round(column.right - inset - slotIndex * stepPx)
}

/** X di celah antar dua kolom pelaksana (bus horizontal lintas kolom). */
export function pickColumnGutterBusX(
  fromColumn: FlowchartPelaksanaBoundsRect,
  toColumn: FlowchartPelaksanaBoundsRect,
  gutterSlot: number,
): number {
  const step = 8
  if (fromColumn.left <= toColumn.left) {
    const gapLeft = fromColumn.right
    const gapRight = toColumn.left
    const mid = (gapLeft + gapRight) / 2
    return Math.round(mid + (gutterSlot % 2 === 0 ? -1 : 1) * Math.ceil(gutterSlot / 2) * step)
  }
  const gapLeft = toColumn.right
  const gapRight = fromColumn.left
  const mid = (gapLeft + gapRight) / 2
  return Math.round(mid + (gutterSlot % 2 === 0 ? 1 : -1) * Math.ceil(gutterSlot / 2) * step)
}
