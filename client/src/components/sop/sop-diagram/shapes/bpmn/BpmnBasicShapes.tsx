/**
 * Shape BPMN sederhana: Event (lingkaran) dan Gateway (diamond).
 * Digabung dalam satu file karena ukuran kecil (~25–38 baris masing-masing).
 */
import { useMemo } from 'react'
import {
  BPMN_DECISION_TEXT_OFFSET_Y,
  BPMN_EVENT_RADIUS,
  BPMN_GATEWAY_HALF_SIZE,
} from '../../layout/bpmnDiagramMetrics'
import { BpmnDecisionText } from './DecisionText'

// ----- Event -----

interface EventProps {
  id?: string
  x?: number
  y?: number
  text?: string
  /** Lingkaran tebal = event akhir (BPMN end). */
  variant?: 'start' | 'end'
}

export function Event({
  id,
  x = 0,
  y = 0,
  text = 'Mulai',
  variant = 'start',
}: EventProps) {
  const isEnd = variant === 'end'
  return (
    <g id={id}>
      <circle
        cx={x}
        cy={y}
        r={BPMN_EVENT_RADIUS}
        fill="white"
        stroke="#000"
        strokeWidth={isEnd ? 4 : 2}
      />
      {isEnd && (
        <circle
          cx={x}
          cy={y}
          r={BPMN_EVENT_RADIUS - 5}
          fill="none"
          stroke="#000"
          strokeWidth={2}
        />
      )}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fontWeight="500"
        fill="black"
      >
        {text}
      </text>
    </g>
  )
}

// ----- Gateway -----

interface GatewayProps {
  id?: string
  x?: number
  y?: number
  name?: string
}

export function Gateway({ id, x = 0, y = 0, name }: GatewayProps) {
  const diamondPath = useMemo(
    () =>
      `M ${x} ${y - BPMN_GATEWAY_HALF_SIZE} L ${x + BPMN_GATEWAY_HALF_SIZE} ${y} L ${x} ${y + BPMN_GATEWAY_HALF_SIZE} L ${x - BPMN_GATEWAY_HALF_SIZE} ${y} Z`,
    [x, y]
  )

  return (
    <>
      <g id={id}>
        <path d={diamondPath} fill="white" stroke="#000" strokeWidth="2" />
      </g>
      {name?.trim() && (
        <BpmnDecisionText
          stepId={id ?? ''}
          stepName={name}
          x={x}
          y={y + BPMN_DECISION_TEXT_OFFSET_Y}
        />
      )}
    </>
  )
}
