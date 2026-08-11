import { useState, useCallback, useRef } from 'react'
import {
  DIAGRAM_CHAR_WIDTH_APPROX,
  DIAGRAM_MAX_SHAPE_WIDTH,
  wrapDiagramText,
} from '../../layout/wrapDiagramText'

const LINE_HEIGHT = 14

export interface BpmnDecisionTextProps {
  stepId: string
  stepName: string
  x: number
  y: number
  /** Override position (e.g. from labelConfig.positions[`step-${seq}`]) */
  customPosition?: { x: number; y: number } | null
  editMode?: boolean
  onPositionChanged?: (stepId: string, position: { x: number; y: number }) => void
}

export function BpmnDecisionText({
  stepId,
  stepName,
  x,
  y,
  customPosition,
  editMode,
  onPositionChanged,
}: BpmnDecisionTextProps) {
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const textLines = wrapDiagramText(stepName)
  const defaultPos = { x, y }
  const effectivePosition = isDragging && dragPosition
    ? dragPosition
    : customPosition ?? defaultPos

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || !onPositionChanged) return
      e.preventDefault()
      e.stopPropagation()
      const container = document.querySelector('#bpmn-container')
      if (!container) return
      const rect = container.getBoundingClientRect()
      const startX = e.clientX - rect.left - effectivePosition.x
      const startY = e.clientY - rect.top - effectivePosition.y
      lastPosRef.current = { x: effectivePosition.x, y: effectivePosition.y }
      setDragPosition(lastPosRef.current)
      setIsDragging(true)

      const onMove = (ev: MouseEvent) => {
        const nx = ev.clientX - rect.left - startX
        const ny = ev.clientY - rect.top - startY
        lastPosRef.current = { x: nx, y: ny }
        setDragPosition({ x: nx, y: ny })
      }
      const onUp = () => {
        setIsDragging(false)
        onPositionChanged(stepId, { ...lastPosRef.current })
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [editMode, onPositionChanged, stepId, effectivePosition.x, effectivePosition.y]
  )

  const totalTextHeight = textLines.length * LINE_HEIGHT
  const clickAreaHeight = Math.max(30, totalTextHeight + 10)
  const longestLine = textLines.reduce((a, b) => (a.length >= b.length ? a : b), '')
  const clickAreaWidth = Math.min(
    DIAGRAM_MAX_SHAPE_WIDTH,
    Math.max(80, longestLine.length * DIAGRAM_CHAR_WIDTH_APPROX + 20),
  )

  return (
    <g>
      {editMode && (
        <rect
          x={effectivePosition.x - clickAreaWidth / 2}
          y={effectivePosition.y - clickAreaHeight / 2}
          width={clickAreaWidth}
          height={clickAreaHeight}
          fill="transparent"
          stroke="#3b82f6"
          strokeWidth={1}
          strokeDasharray="2,2"
          rx={4}
          className="cursor-move hover:opacity-30 print:hidden"
          style={{ pointerEvents: 'all', opacity: 0.6 }}
          onMouseDown={handleMouseDown}
        />
      )}
      <text
        x={effectivePosition.x}
        y={effectivePosition.y - ((textLines.length - 1) * LINE_HEIGHT) / 2}
        textAnchor="middle"
        className="text-sm font-medium fill-black"
        style={{ pointerEvents: 'none' }}
      >
        {textLines.map((line, index) => (
          <tspan
            key={index}
            x={effectivePosition.x}
            dy={index === 0 ? '0.35em' : `${LINE_HEIGHT}px`}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  )
}
