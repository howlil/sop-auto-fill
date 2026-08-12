import { useState } from 'react'
import { Activity, History, PenLine } from 'lucide-react'
import {
  CollapsedStripButton,
  CollapsibleSidePanel,
  CollapsibleSidePanelContent,
  CollapsibleSidePanelHeader,
  PanelTabStrip,
} from '@/components/ui/collapsible-side-panel'
import { RiwayatStatusPanel } from '@/pages/penyusun/sop/components/RiwayatStatusPanel'
import { RiwayatVersiPanel } from '@/pages/penyusun/sop/components/RiwayatVersiPanel'
import { DetailSOPMetadataPanel } from './DetailSopMetadataPanel'
import type { PenyusunWorkbenchLogEdit, SopRiwayatVersiRow } from '@/types/dto/sop.dto'

export interface DetailSOPPenyusunSidePanelProps {
  workspaceId: string
  detailSopId: string
  sopId: string
  auditEntries?: PenyusunWorkbenchLogEdit[]
  isReadOnly?: boolean
  onBuatVersiBaru?: (source: SopRiwayatVersiRow) => void
  isBuatVersiBaruPending?: boolean
}

type TabId = 'edit' | 'versi' | 'aktivitas'

export function DetailSOPPenyusunSidePanel({
  workspaceId,
  detailSopId,
  sopId,
  auditEntries = [],
  isReadOnly = false,
  onBuatVersiBaru,
  isBuatVersiBaruPending = false,
}: DetailSOPPenyusunSidePanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('edit')
  const tabs = [
    { id: 'edit', label: isReadOnly ? 'Informasi' : 'Edit', icon: <PenLine className="h-3.5 w-3.5" /> },
    { id: 'versi', label: 'Versi', icon: <History className="h-3.5 w-3.5" /> },
    { id: 'aktivitas', label: 'Aktivitas', icon: <Activity className="h-3.5 w-3.5" /> },
  ]

  return (
    <CollapsibleSidePanel
      side="right"
      collapsed={collapsed}
      widthCollapsed="w-10"
      widthExpanded="w-[min(24rem,100%)]"
    >
      {collapsed ? (
        <CollapsedStripButton
          label={tabs[0].label}
          icon={tabs[0].icon}
          onClick={() => setCollapsed(false)}
        />
      ) : (
        <>
          <CollapsibleSidePanelHeader side="right" onCollapse={() => setCollapsed(true)}>
            <PanelTabStrip
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as TabId)}
            />
          </CollapsibleSidePanelHeader>
          <CollapsibleSidePanelContent className="px-2 pb-2 pt-1 sm:px-2">
            {activeTab === 'edit' ? <DetailSOPMetadataPanel /> : null}
            {activeTab === 'versi' ? (
              <RiwayatVersiPanel
                workspaceId={workspaceId}
                sopId={sopId}
                activeDetailSopId={detailSopId}
                isReadOnly={isReadOnly}
                onBuatVersiBaru={onBuatVersiBaru}
                isBuatVersiBaruPending={isBuatVersiBaruPending}
              />
            ) : null}
            {activeTab === 'aktivitas' ? (
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
