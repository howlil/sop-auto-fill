import { segmentsOverlap, type OccupiedSegment } from './orthogonalRouter'

export interface RoutableConnectionMeta {
  id: string
  from: string
  to: string
  label?: string | null
  sourceType?: string
}

function isYaLabel(label: string | null | undefined): boolean {
  return /^(ya|yes|y)$/i.test((label ?? '').trim())
}

function isTidakLabel(label: string | null | undefined): boolean {
  return /^(tidak|no|n)$/i.test((label ?? '').trim())
}

function seqFromShapeId(id: string): number {
  const m = id.match(/(\d+)/)
  return m ? Number(m[1]) : -1
}

function hashId(seed: number, id: string): number {
  return (
    id
      .split('')
      .reduce(
        (acc, c, i) => acc + (c.charCodeAt(0) * ((seed + 1) * (i + 31) + seed * 7)),
        0,
      ) >>> 0
  )
}

/** Estimasi jarak topologi (langkah) untuk prioritas routing panjang dulu. */
export function estimateConnectionSpan(conn: RoutableConnectionMeta): number {
  const fromSeq = seqFromShapeId(conn.from)
  const toSeq = seqFromShapeId(conn.to)
  if (fromSeq >= 0 && toSeq >= 0) return Math.abs(toSeq - fromSeq)
  return 1
}

function labelRouteOrder(label: string | null | undefined): number {
  if (!label) return 0
  if (isYaLabel(label)) return 1
  if (isTidakLabel(label)) return 2
  return 0
}

function segmentsCross(
  a: OccupiedSegment,
  b: OccupiedSegment,
): boolean {
  const aHoriz = a.y1 === a.y2
  const bHoriz = b.y1 === b.y2
  const aVert = a.x1 === a.x2
  const bVert = b.x1 === b.x2
  if (aHoriz && bVert) {
    return (
      a.y1 >= Math.min(b.y1, b.y2) &&
      a.y1 <= Math.max(b.y1, b.y2) &&
      b.x1 >= Math.min(a.x1, a.x2) &&
      b.x1 <= Math.max(a.x1, a.x2)
    )
  }
  if (aVert && bHoriz) {
    return (
      a.x1 >= Math.min(b.x1, b.x2) &&
      a.x1 <= Math.max(b.x1, b.x2) &&
      b.y1 >= Math.min(a.y1, a.y2) &&
      b.y1 <= Math.max(a.y1, a.y2)
    )
  }
  return false
}

/** Koneksi yang ikut serta dalam pelanggaran silang antar segmen. */
export function findConnectionIdsWithCrossings(
  segmentsByConnection: Map<string, OccupiedSegment[]>,
): string[] {
  const ids = [...segmentsByConnection.keys()]
  const violators = new Set<string>()
  for (let i = 0; i < ids.length; i++) {
    const segsA = segmentsByConnection.get(ids[i]!) ?? []
    for (let j = i + 1; j < ids.length; j++) {
      const segsB = segmentsByConnection.get(ids[j]!) ?? []
      for (const a of segsA) {
        for (const b of segsB) {
          if (segmentsOverlap(a, b) || segmentsCross(a, b)) {
            violators.add(ids[i]!)
            violators.add(ids[j]!)
          }
        }
      }
    }
  }
  return [...violators]
}

/**
 * Urutan render/routing: panjang besar dulu, lalu label (Tidak/Ya), reconcile priority, seed.
 */
export function sortConnectionsForRouting<T extends RoutableConnectionMeta>(
  connections: T[],
  pathLayoutSeed: number,
  options?: {
    priorityIds?: ReadonlySet<string>
    reconcilePass?: number
    /** Saat reconcile: violator diurutkan terakhir agar melihat occupied koneksi lain. */
    priorityRoutesLast?: boolean
  },
): T[] {
  const priority = options?.priorityIds
  const violatorsLast =
    options?.priorityRoutesLast === true && (options.reconcilePass ?? 0) > 0
  const list = [...connections]
  list.sort((a, b) => {
    const priA = priority?.has(a.id) ? (violatorsLast ? 1 : 0) : (violatorsLast ? 0 : 1)
    const priB = priority?.has(b.id) ? (violatorsLast ? 1 : 0) : (violatorsLast ? 0 : 1)
    if (priA !== priB) return priA - priB
    const spanDiff = estimateConnectionSpan(b) - estimateConnectionSpan(a)
    if (spanDiff !== 0) return spanDiff
    const orderA = labelRouteOrder(a.label)
    const orderB = labelRouteOrder(b.label)
    const labelDiff = orderB - orderA
    if (labelDiff !== 0) return labelDiff
    if (orderA === 2) {
      const fromSeqA = seqFromShapeId(a.from)
      const toSeqA = seqFromShapeId(a.to)
      const fromSeqB = seqFromShapeId(b.from)
      const toSeqB = seqFromShapeId(b.to)
      const loopBackA = toSeqA >= 0 && fromSeqA >= 0 && toSeqA < fromSeqA ? 0 : 1
      const loopBackB = toSeqB >= 0 && fromSeqB >= 0 && toSeqB < fromSeqB ? 0 : 1
      const loopDiff = loopBackA - loopBackB
      if (loopDiff !== 0) return loopDiff
    }
    const hashDiff = hashId(pathLayoutSeed, a.id) - hashId(pathLayoutSeed, b.id)
    if (hashDiff !== 0) return hashDiff
    if ((options?.reconcilePass ?? 0) > 0) {
      return a.id.localeCompare(b.id)
    }
    return 0
  })
  if (list.length > 1 && pathLayoutSeed > 0 && (options?.reconcilePass ?? 0) === 0) {
    const rot = pathLayoutSeed % list.length
    if (rot !== 0) return [...list.slice(rot), ...list.slice(0, rot)]
  }
  return list
}
