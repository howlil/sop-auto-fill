import { useMemo } from 'react'
import type { PositionedOpcEndpoint } from '../core/route/flowchart/flowchartPagination'
import type { ImplementerColumnBoundsMap } from '../core/route/flowchart/flowchart-column-bounds.util'
import {
  buildFlowchartTableColumnPercents,
  centerPercentToLeftCss,
  centerXToLeftPx,
  computeOpcStackTopPx,
  layoutOpcEndpointPlacements,
  OPC_CONNECTOR_HEIGHT_PX,
  OPC_CONNECTOR_STACK_GAP_PX,
} from '../core/route/flowchart/flowchart-opc-placement.util'
import { FlowchartOffPageConnector } from '../shapes/flowchart/OffPageConnector'

interface FlowchartOpcRowProps {
  endpoints: PositionedOpcEndpoint[]
  position: 'top' | 'bottom'
  implementers: Array<{ id: string }>
  kegiatanPercent: number
  pelaksanaColPercent: number
  columnBounds?: ImplementerColumnBoundsMap | null
  className?: string
}

export function FlowchartOpcRow({
  endpoints,
  position,
  implementers,
  kegiatanPercent,
  pelaksanaColPercent,
  columnBounds,
  className = '',
}: FlowchartOpcRowProps) {
  const tableColumns = useMemo(
    () => buildFlowchartTableColumnPercents(kegiatanPercent, pelaksanaColPercent),
    [kegiatanPercent, pelaksanaColPercent],
  )
  const placements = useMemo(
    () =>
      layoutOpcEndpointPlacements(endpoints, {
        implementers,
        columnBounds,
        tableColumns,
      }),
    [endpoints, implementers, columnBounds, tableColumns],
  )
  if (placements.length === 0) return null
  const maxStack = placements.reduce((max, p) => Math.max(max, p.stackIndex), 0)
  const rowHeight =
    (maxStack + 1) * OPC_CONNECTOR_HEIGHT_PX + maxStack * OPC_CONNECTOR_STACK_GAP_PX

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ minHeight: rowHeight }}
      data-opc-row={position}
    >
      {placements.map((placement) => {
        const topPx = computeOpcStackTopPx(placement.stackIndex)
        const usePx = placement.centerXPx != null
        const style = usePx
          ? { left: centerXToLeftPx(placement.centerXPx!), top: topPx }
          : {
              left: centerPercentToLeftCss(placement.centerPercent),
              top: topPx,
              transform: 'translateX(-50%)',
            }
        return (
          <FlowchartOffPageConnector
            key={placement.elementId}
            id={placement.elementId}
            letter={placement.opc.letter}
            className="absolute"
            style={style}
          />
        )
      })}
    </div>
  )
}
