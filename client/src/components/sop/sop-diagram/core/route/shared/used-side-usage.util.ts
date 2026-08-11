import type { UsedSides } from './connector-side.types'
import type { ArrowPathPoint } from '../../sopDiagramTypes'

export interface UsedSidePayload {
  connectionId: string
  from: string
  to: string
  sSide: 'top' | 'bottom' | 'left' | 'right'
  eSide: 'top' | 'bottom' | 'left' | 'right'
  startPoint?: ArrowPathPoint
  endPoint?: ArrowPathPoint
  bendPoints?: ArrowPathPoint[]
}

const SIDE_KEYS: Array<UsedSidePayload['sSide']> = ['top', 'bottom', 'left', 'right']

function cloneDirection(
  dir: UsedSides[string]['in'] | UsedSides[string]['out'] | undefined,
): Partial<Record<UsedSidePayload['sSide'], string[]>> {
  const next: Partial<Record<UsedSidePayload['sSide'], string[]>> = {}
  for (const side of SIDE_KEYS) {
    const values = dir?.[side]
    if (values?.length) next[side] = [...values]
  }
  return next
}

function stripConnection(
  dir: Partial<Record<UsedSidePayload['sSide'], string[]>>,
  connectionId: string,
): void {
  for (const side of SIDE_KEYS) {
    const values = dir[side]
    if (!values?.length) continue
    const filtered = values.filter((id) => id !== connectionId)
    if (filtered.length > 0) dir[side] = filtered
    else delete dir[side]
  }
}

function appendUnique(
  dir: Partial<Record<UsedSidePayload['sSide'], string[]>>,
  side: UsedSidePayload['sSide'],
  connectionId: string,
): void {
  const values = dir[side] ?? []
  if (!values.includes(connectionId)) dir[side] = [...values, connectionId]
}

function sameDirection(
  a: UsedSides[string]['in'] | UsedSides[string]['out'] | undefined,
  b: UsedSides[string]['in'] | UsedSides[string]['out'] | undefined,
): boolean {
  for (const side of SIDE_KEYS) {
    const av = a?.[side] ?? []
    const bv = b?.[side] ?? []
    if (av.length !== bv.length) return false
    for (let i = 0; i < av.length; i += 1) {
      if (av[i] !== bv[i]) return false
    }
  }
  return true
}

function sameShapeUsage(a: UsedSides[string] | undefined, b: UsedSides[string] | undefined): boolean {
  return sameDirection(a?.in, b?.in) && sameDirection(a?.out, b?.out)
}

export function applyUsedSidePayload(prev: UsedSides, payload: UsedSidePayload): UsedSides {
  const affected = [payload.from, payload.to].filter(Boolean)
  if (affected.length === 0) return prev

  const next: UsedSides = { ...prev }
  const touched = new Set(affected)

  for (const shapeId of touched) {
    const current = prev[shapeId]
    next[shapeId] = {
      in: cloneDirection(current?.in),
      out: cloneDirection(current?.out),
    }
  }

  if (payload.from) {
    stripConnection(next[payload.from].out ?? {}, payload.connectionId)
    appendUnique(next[payload.from].out ?? {}, payload.sSide, payload.connectionId)
  }
  if (payload.to) {
    stripConnection(next[payload.to].in ?? {}, payload.connectionId)
    appendUnique(next[payload.to].in ?? {}, payload.eSide, payload.connectionId)
  }

  for (const shapeId of touched) {
    const shape = next[shapeId]
    if (shape.in && Object.keys(shape.in).length === 0) delete shape.in
    if (shape.out && Object.keys(shape.out).length === 0) delete shape.out
    if (Object.keys(shape).length === 0) delete next[shapeId]
  }

  for (const shapeId of touched) {
    if (!sameShapeUsage(prev[shapeId], next[shapeId])) return next
  }
  return prev
}
