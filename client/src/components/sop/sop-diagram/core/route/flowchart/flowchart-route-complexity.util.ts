import { seqFromFlowchartShapeId } from './flowchart-loopback-route.util'

export type FlowchartRouteComplexity = 'simple' | 'medium' | 'complex'

export interface ClassifyFlowchartRouteComplexityInput {
  fromId: string
  toId: string
  destAbove: boolean
  destBelow: boolean
  sameCol: boolean
  isCrossColumn: boolean
  sourceType?: string
  targetType?: string
  label?: string | null
}

/** Koneksi linear berurutan (N→N+1, ke bawah, bukan cabang decision). */
export function isSimpleSequentialFlow(input: ClassifyFlowchartRouteComplexityInput): boolean {
  const fromSeq = seqFromFlowchartShapeId(input.fromId)
  const toSeq = seqFromFlowchartShapeId(input.toId)
  if (fromSeq < 0 || toSeq < 0) return false
  if (!input.destBelow || input.destAbove) return false
  if (toSeq !== fromSeq + 1) return false
  if (input.sourceType === 'flowchart-decision') return false
  if (input.targetType === 'flowchart-opc' || input.sourceType === 'flowchart-opc') return false
  if (input.label) return false
  return true
}

export function rowSpanBetween(fromId: string, toId: string): number {
  const fromSeq = seqFromFlowchartShapeId(fromId)
  const toSeq = seqFromFlowchartShapeId(toId)
  if (fromSeq < 0 || toSeq < 0) return 0
  return Math.abs(toSeq - fromSeq)
}

export function classifyFlowchartRouteComplexity(
  input: ClassifyFlowchartRouteComplexityInput,
): FlowchartRouteComplexity {
  if (isSimpleSequentialFlow(input)) return 'simple'
  if (input.destAbove && input.sourceType === 'flowchart-decision') return 'complex'
  if (input.destAbove) return 'complex'
  const span = rowSpanBetween(input.fromId, input.toId)
  if (input.isCrossColumn && span >= 2) return 'complex'
  if (input.sourceType === 'flowchart-decision') return 'medium'
  if (span >= 3) return 'medium'
  return 'medium'
}
