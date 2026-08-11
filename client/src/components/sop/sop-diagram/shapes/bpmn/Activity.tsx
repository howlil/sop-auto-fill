import { useMemo } from 'react'
import { BPMN_TASK_PADDING } from '../../layout/bpmnDiagramMetrics'
import { BPMN_TASK_MIN_CHARS_PER_LINE } from '../../layout/bpmnDiagramMetrics'
import {
  DIAGRAM_LINE_HEIGHT,
  layoutDiagramTaskLabel,
} from '../../layout/wrapDiagramText'

const LINE_HEIGHT = DIAGRAM_LINE_HEIGHT

interface ActivityProps {
  id?: string
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
}

export function Activity({
  id,
  x = 0,
  y = 0,
  width = 80,
  height = 40,
  name = '',
}: ActivityProps) {
  const textLines = useMemo(
    () =>
      layoutDiagramTaskLabel(name ?? '', width, height, {
        horizontalPadding: BPMN_TASK_PADDING,
        verticalPadding: BPMN_TASK_PADDING,
        minCharsPerLine: BPMN_TASK_MIN_CHARS_PER_LINE,
      }),
    [name, width, height],
  )

  const clipId = id ? `activity-clip-${id}` : undefined

  const firstTspanDy = useMemo(() => {
    if (textLines.length <= 1) return -((textLines.length - 1) * LINE_HEIGHT) / 2
    return -(textLines.length - 1) * (LINE_HEIGHT / 2)
  }, [textLines])

  const rectX = x - width / 2
  const rectY = y - height / 2

  return (
    <g id={id}>
      {clipId && (
        <defs>
          <clipPath id={clipId}>
            <rect x={rectX} y={rectY} width={width} height={height} rx="10" ry="10" />
          </clipPath>
        </defs>
      )}
      <rect
        x={rectX}
        y={rectY}
        width={width}
        height={height}
        fill="white"
        stroke="#000"
        strokeWidth="2"
        rx="10"
        ry="10"
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontSize="13"
        dominantBaseline="central"
        clipPath={clipId ? `url(#${clipId})` : undefined}
      >
        {textLines.map((line, index) => (
          <tspan key={index} x={x} dy={index === 0 ? firstTspanDy : LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}
