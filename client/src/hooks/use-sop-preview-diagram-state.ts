import { useMemo } from 'react'
import {
  buildDiagramStateForPreviewTab,
  type DiagramPreviewStateInput,
} from '@/lib/sop/diagram-config.mapper'

export function useSopPreviewDiagramState(
  input: Omit<DiagramPreviewStateInput, 'activeTab'> | null,
  activeTab: 'flowchart' | 'bpmn',
) {
  return useMemo(() => {
    if (input === null) {
      return { pathLayoutSeed: 0, arrowConfig: {}, labelConfig: {} }
    }
    return buildDiagramStateForPreviewTab({ ...input, activeTab })
  }, [input, activeTab])
}
