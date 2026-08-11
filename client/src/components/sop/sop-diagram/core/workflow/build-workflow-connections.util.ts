import type { FlowchartConnection, LabelConfig, SOPStep } from '../sopDiagramTypes'
import { sortConnectionsForRouting } from '../route/shared/connection-route-order.util'

export interface WorkflowStepLike extends Pick<SOPStep, 'id_step' | 'seq_number' | 'type' | 'id_next_step_if_yes' | 'id_next_step_if_no'> {
  id_step: string
  seq_number: number
  type: string
}

export interface BuildWorkflowConnectionsInput {
  steps: WorkflowStepLike[]
  shapePrefix: string
  labelConfig?: LabelConfig
  pathLayoutSeed?: number
}

function stepShapeType(type: string): FlowchartConnection['sourceType'] {
  if (type === 'terminator') return 'flowchart-terminator'
  if (type === 'decision') return 'flowchart-decision'
  return 'flowchart-process'
}

function buildRowIdToSeqMap(steps: WorkflowStepLike[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const step of steps) {
    if (!step.id_step.endsWith('-terminator')) {
      map.set(step.id_step, step.seq_number)
    }
  }
  return map
}

/**
 * Bangun sequence flow dari data langkah SOP (sama dengan flowchart, prefix shape boleh beda).
 * Terminator sintetis: start-terminator (seq 0) dan end-terminator (seq terakhir).
 */
export function buildWorkflowConnections(input: BuildWorkflowConnectionsInput): FlowchartConnection[] {
  const { steps, shapePrefix, labelConfig, pathLayoutSeed = 0 } = input
  const customLabels = labelConfig?.custom_labels ?? {}
  const rowIdToSeq = buildRowIdToSeqMap(steps)
  const sorted = [...steps].sort((a, b) => a.seq_number - b.seq_number)
  const workflowSteps = sorted.filter(
    (s) => s.id_step !== 'start-terminator' && s.id_step !== 'end-terminator',
  )
  const start = sorted.find((s) => s.id_step === 'start-terminator')
  const end = sorted.find((s) => s.id_step === 'end-terminator')
  const list: FlowchartConnection[] = []
  const nodeId = (seq: number) => `${shapePrefix}${seq}`

  if (start && workflowSteps.length > 0) {
    const first = workflowSteps[0]!
    list.push({
      id: `conn-${start.seq_number}-to-${first.seq_number}`,
      from: nodeId(start.seq_number),
      to: nodeId(first.seq_number),
      sourceType: 'flowchart-terminator',
      targetType: stepShapeType(first.type),
    })
  }

  const pushEdge = (
    fromSeq: number,
    toSeq: number,
    idSuffix: string,
    sourceType: FlowchartConnection['sourceType'],
    targetType: FlowchartConnection['targetType'],
    label?: string,
  ): void => {
    list.push({
      id: `conn-${fromSeq}${idSuffix}-${toSeq}`,
      from: nodeId(fromSeq),
      to: nodeId(toSeq),
      label,
      sourceType,
      targetType,
    })
  }

  for (let i = 0; i < workflowSteps.length; i += 1) {
    const step = workflowSteps[i]!
    if (step.type === 'decision') {
      if (step.id_next_step_if_yes) {
        const toYes = rowIdToSeq.get(step.id_next_step_if_yes)
        if (toYes != null) {
          const target = sorted.find((s) => s.seq_number === toYes)
          const yesKey = `step-${step.seq_number}-yes`
          pushEdge(
            step.seq_number,
            toYes,
            '-yes',
            'flowchart-decision',
            target ? stepShapeType(target.type) : 'flowchart-process',
            customLabels[yesKey] ?? 'Ya',
          )
        }
      }
      if (step.id_next_step_if_no) {
        const toNo = rowIdToSeq.get(step.id_next_step_if_no)
        if (toNo != null) {
          const target = sorted.find((s) => s.seq_number === toNo)
          const noKey = `step-${step.seq_number}-no`
          pushEdge(
            step.seq_number,
            toNo,
            '-no',
            'flowchart-decision',
            target ? stepShapeType(target.type) : 'flowchart-process',
            customLabels[noKey] ?? 'Tidak',
          )
        }
      }
      continue
    }
    const explicitNextSeq =
      step.id_next_step_if_yes != null
        ? rowIdToSeq.get(step.id_next_step_if_yes)
        : undefined
    if (explicitNextSeq != null) {
      const target = sorted.find((s) => s.seq_number === explicitNextSeq)
      pushEdge(
        step.seq_number,
        explicitNextSeq,
        '-to',
        stepShapeType(step.type),
        target ? stepShapeType(target.type) : 'flowchart-process',
      )
      continue
    }
    if (i < workflowSteps.length - 1) {
      const toStep = workflowSteps[i + 1]!
      pushEdge(
        step.seq_number,
        toStep.seq_number,
        '-to',
        stepShapeType(step.type),
        stepShapeType(toStep.type),
      )
    }
  }

  if (end) {
    const outCount = new Map<string, number>()
    for (const conn of list) {
      outCount.set(conn.from, (outCount.get(conn.from) ?? 0) + 1)
    }
    for (const step of workflowSteps) {
      const from = nodeId(step.seq_number)
      if ((outCount.get(from) ?? 0) > 0) continue
      list.push({
        id: `conn-${step.seq_number}-to-${end.seq_number}`,
        from,
        to: nodeId(end.seq_number),
        sourceType: stepShapeType(step.type),
        targetType: 'flowchart-terminator',
      })
    }
  }

  return sortConnectionsForRouting(list, pathLayoutSeed)
}
