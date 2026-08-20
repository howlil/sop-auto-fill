import { useState } from 'react'
import { Activity, History, PenLine, Sparkles } from 'lucide-react'
import {
  CollapsedStripButton,
  CollapsibleSidePanel,
  CollapsibleSidePanelContent,
  CollapsibleSidePanelHeader,
  PanelTabStrip,
} from '@/components/ui/collapsible-side-panel'
import { RiwayatStatusPanel } from '@/pages/penyusun/sop/components/RiwayatStatusPanel'
import { RiwayatVersiPanel } from '@/pages/penyusun/sop/components/RiwayatVersiPanel'
import { AiSopQualityReviewPanel, type AiSopQualityReviewPanelProps } from './AiSopQualityReviewPanel'
import { DetailSOPMetadataPanel } from './DetailSopMetadataPanel'
import type { PenyusunWorkbenchLogEdit, SopRiwayatVersiRow } from '@/types/dto/sop.dto'

export type DetailSopSidePanelTabId = 'edit' | 'ai-review' | 'versi' | 'aktivitas'

export interface DetailSOPPenyusunSidePanelProps {
  workspaceId: string
  detailSopId: string
  sopId: string
  activeTab: DetailSopSidePanelTabId
  onActiveTabChange: (tab: DetailSopSidePanelTabId) => void
  aiReviewPanelProps: AiSopQualityReviewPanelProps
  auditEntries?: PenyusunWorkbenchLogEdit[]
  isReadOnly?: boolean
  onBuatVersiBaru?: (source: SopRiwayatVersiRow) => void
  isBuatVersiBaruPending?: boolean
}

export function DetailSOPPenyusunSidePanel({
  workspaceId,
  detailSopId,
  sopId,
  activeTab,
  onActiveTabChange,
  aiReviewPanelProps,
  auditEntries = [],
  isReadOnly = false,
  onBuatVersiBaru,
  isBuatVersiBaruPending = false,
}: DetailSOPPenyusunSidePanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const visibleActiveTab = isReadOnly && activeTab === 'ai-review' ? 'edit' : activeTab
  const tabs = [
    { id: 'edit', label: isReadOnly ? 'Informasi' : 'Edit', icon: <PenLine className="h-3.5 w-3.5" /> },
    ...(!isReadOnly
      ? [{ id: 'ai-review', label: 'AI Review', icon: <Sparkles className="h-3.5 w-3.5" /> }]
      : []),
    { id: 'versi', label: 'Versi', icon: <History className="h-3.5 w-3.5" /> },
    { id: 'aktivitas', label: 'Aktivitas', icon: <Activity className="h-3.5 w-3.5" /> },
  ]

  const currentTab = tabs.find((tab) => tab.id === visibleActiveTab) ?? tabs[0]

  return (
    <CollapsibleSidePanel
      side="right"
      collapsed={collapsed}
      widthCollapsed="w-10"
      widthExpanded="w-[min(24rem,100%)]"
    >
      {collapsed ? (
        <CollapsedStripButton
          label={currentTab.label}
          icon={currentTab.icon}
          onClick={() => setCollapsed(false)}
        />
      ) : (
        <>
          <CollapsibleSidePanelHeader side="right" onCollapse={() => setCollapsed(true)}>
            <PanelTabStrip
              tabs={tabs}
              activeTab={visibleActiveTab}
              onTabChange={(tab) => onActiveTabChange(tab as DetailSopSidePanelTabId)}
            />
          </CollapsibleSidePanelHeader>
          <CollapsibleSidePanelContent className="px-2 pb-2 pt-1 sm:px-2">
            {visibleActiveTab === 'edit' ? <DetailSOPMetadataPanel /> : null}
            {visibleActiveTab === 'ai-review' && !isReadOnly ? (
              <AiSopQualityReviewPanel {...aiReviewPanelProps} />
            ) : null}
            {visibleActiveTab === 'versi' ? (
              <RiwayatVersiPanel
                workspaceId={workspaceId}
                sopId={sopId}
                activeDetailSopId={detailSopId}
                isReadOnly={isReadOnly}
                onBuatVersiBaru={onBuatVersiBaru}
                isBuatVersiBaruPending={isBuatVersiBaruPending}
              />
            ) : null}
            {visibleActiveTab === 'aktivitas' ? (
              <div className="p-3">
                <RiwayatStatusPanel entries={auditEntries} />
              </div>
            ) : null}
          </CollapsibleSidePanelContent>
        </>
      )}
    </CollapsibleSidePanel>
  )
}
