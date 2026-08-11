import {
  preferCenterAnchorDistance,
  sideLengthPx,
  type DiagramShapeRect,
} from '../../shared/connector-anchor.util'
import type { Side, UsedSides } from '../bpmnRouter'

export interface BpmnPortLedger {
  usedSides: UsedSides
}

export function createBpmnPortLedger(): BpmnPortLedger {
  return { usedSides: {} }
}

function directionEntries(
  ledger: BpmnPortLedger,
  nodeId: string,
  direction: 'in' | 'out',
  side: Side,
): string[] {
  const node = ledger.usedSides[nodeId] ?? {}
  ledger.usedSides[nodeId] = node
  const sides = node[direction] ?? {}
  node[direction] = sides
  const entries = sides[side] ?? []
  sides[side] = entries
  return entries
}

export function reserveBpmnPortPair(
  ledger: BpmnPortLedger,
  connectionId: string,
  fromNodeId: string,
  toNodeId: string,
  sSide: Side,
  eSide: Side,
): void {
  const outgoing = directionEntries(ledger, fromNodeId, 'out', sSide)
  if (!outgoing.includes(connectionId)) outgoing.push(connectionId)
  const incoming = directionEntries(ledger, toNodeId, 'in', eSide)
  if (!incoming.includes(connectionId)) incoming.push(connectionId)
}

export function countReservedBpmnPorts(
  ledger: BpmnPortLedger,
  nodeId: string,
  direction: 'in' | 'out',
  side: Side,
): number {
  return ledger.usedSides[nodeId]?.[direction]?.[side]?.length ?? 0
}

export function bpmnPortDistance(
  ledger: BpmnPortLedger,
  nodeId: string,
  direction: 'in' | 'out',
  side: Side,
  shape: DiagramShapeRect,
  slotOffset = 0,
  isDiamond = false,
): number {
  if (isDiamond) return 0.5
  const reserved = countReservedBpmnPorts(ledger, nodeId, direction, side)
  return preferCenterAnchorDistance(reserved + slotOffset, sideLengthPx(shape, side))
}
