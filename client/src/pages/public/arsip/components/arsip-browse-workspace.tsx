import { useState } from 'react'
import { Building2, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CollapsedStripButton,
  CollapsibleSidePanel,
  CollapsibleSidePanelContent,
  CollapsibleSidePanelHeader,
  SimplePanelHeader,
} from '@/components/ui/collapsible-side-panel'
import type { PublicOpdItem, PublicSopItem } from '@/types/dto/sop-public.dto'
import type { PaginationMetaDto } from '@/types/dto/evaluasi.dto'
import { ArsipOpdSidebar } from './arsip-opd-sidebar'
import { ArsipSopPanel } from './arsip-sop-panel'
import { ArsipSopPreviewPane } from './arsip-sop-preview-pane'

export interface ArsipBrowseWorkspaceProps {
  isGlobalMode: boolean
  opdId?: string
  selectedOpdName?: string
  detailSopId?: string
  selectedSop?: PublicSopItem
  opdItems: PublicOpdItem[]
  opdFilter: string
  onOpdFilterChange: (value: string) => void
  onSelectOpd: (opdId: string) => void
  onChangeOpd: () => void
  opdLoading: boolean
  opdError: boolean
  opdFetching: boolean
  opdPagination?: PaginationMetaDto
  opdPage: number
  onOpdPageChange: (page: number) => void
  sopPanelTitle: string
  sopPanelSubtitle?: string
  sopItems: PublicSopItem[]
  sopPagination?: PaginationMetaDto
  sopPage: number
  onSopPageChange: (page: number) => void
  sopLoading: boolean
  sopError: boolean
  sopFetching: boolean
  showOpdColumn: boolean
  showSopSearchFilter: boolean
  sopSearch: string
  onSopSearchChange: (value: string) => void
  onSelectSop: (sop: PublicSopItem) => void
  onClosePreview: () => void
  onRefreshPreview: () => void
  sopEmptyTitle: string
  sopEmptyHint: string
}

export function ArsipBrowseWorkspace({
  isGlobalMode,
  opdId,
  selectedOpdName,
  detailSopId,
  selectedSop,
  opdItems,
  opdFilter,
  onOpdFilterChange,
  onSelectOpd,
  onChangeOpd,
  opdLoading,
  opdError,
  opdFetching,
  opdPagination,
  opdPage,
  onOpdPageChange,
  sopPanelTitle,
  sopPanelSubtitle,
  sopItems,
  sopPagination,
  sopPage,
  onSopPageChange,
  sopLoading,
  sopError,
  sopFetching,
  showOpdColumn,
  showSopSearchFilter,
  sopSearch,
  onSopSearchChange,
  onSelectSop,
  onClosePreview,
  onRefreshPreview,
  sopEmptyTitle,
  sopEmptyHint,
}: ArsipBrowseWorkspaceProps) {
  const [navCollapsed, setNavCollapsed] = useState(false)
  const showSopList = isGlobalMode || Boolean(opdId)
  const showOpdPicker = !isGlobalMode && !opdId
  return (
    <div
      className="hidden h-[calc(100dvh-14rem)] min-h-[min(420px,55vh)] max-h-[calc(100dvh-10rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-surface lg:flex"
      aria-label="Penelusuran arsip SOP"
    >
      <CollapsibleSidePanel
        side="left"
        collapsed={navCollapsed}
        widthCollapsed="w-12"
        widthExpanded="w-[min(380px,36vw)]"
        className="h-full max-h-none shrink-0"
      >
        {navCollapsed ? (
          <CollapsedStripButton
            label="Navigasi"
            icon={<PanelLeft className="h-4 w-4 text-muted-foreground" />}
            onClick={() => setNavCollapsed(false)}
          />
        ) : (
          <>
            <CollapsibleSidePanelHeader
              side="left"
              onCollapse={() => setNavCollapsed(true)}
              className="border-border bg-surface-subtle/90 px-2 py-1.5 sm:px-2.5"
            >
              <SimplePanelHeader
                title={isGlobalMode ? 'Hasil pencarian' : 'Navigasi'}
                subtitle={sopPanelSubtitle}
              />
            </CollapsibleSidePanelHeader>
            <CollapsibleSidePanelContent className="flex min-h-0 flex-1 flex-col px-0 pb-0 pt-0">
              {showOpdPicker ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <ArsipOpdSidebar
                    embedded
                    compactPagination
                    items={opdItems}
                    selectedOpdId={opdId}
                    opdFilter={opdFilter}
                    onOpdFilterChange={onOpdFilterChange}
                    onSelectOpd={onSelectOpd}
                    isLoading={opdLoading}
                    isError={opdError}
                    isFetching={opdFetching}
                    pagination={opdPagination}
                    page={opdPage}
                    onPageChange={onOpdPageChange}
                  />
                </div>
              ) : null}
              {!isGlobalMode && opdId ? (
                <SelectedOpdStrip opdName={selectedOpdName ?? 'OPD terpilih'} onChangeOpd={onChangeOpd} />
              ) : null}
              <div className="flex min-h-0 flex-1 flex-col">
                {showSopList ? (
                  <ArsipSopPanel
                    embedded
                    hideHeader
                    listVariant="compact"
                    title={sopPanelTitle}
                    subtitle={sopPanelSubtitle}
                    items={sopItems}
                    pagination={sopPagination}
                    page={sopPage}
                    onPageChange={onSopPageChange}
                    isLoading={sopLoading}
                    isError={sopError}
                    isFetching={sopFetching}
                    showOpdColumn={showOpdColumn}
                    selectedDetailSopId={detailSopId}
                    onSelectSop={onSelectSop}
                    emptyTitle={sopEmptyTitle}
                    emptyHint={sopEmptyHint}
                    showSopSearchFilter={showSopSearchFilter}
                    sopSearch={sopSearch}
                    onSopSearchChange={onSopSearchChange}
                  />
                ) : (
                  <SopListPickOpdHint />
                )}
              </div>
            </CollapsibleSidePanelContent>
          </>
        )}
      </CollapsibleSidePanel>
      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface"
        aria-label="Pratinjau dokumen SOP"
      >
        {detailSopId ? (
          <ArsipSopPreviewPane
            detailSopId={detailSopId}
            pdfUrl={selectedSop?.pdfUrl}
            title={selectedSop?.judul}
            opdName={selectedSop?.opdNama ?? selectedOpdName}
            onClose={onClosePreview}
            onRefresh={onRefreshPreview}
            variant="inline"
            embedded
          />
        ) : (
          <PreviewEmptyState showSopList={showSopList} hasManySops={(sopPagination?.totalItems ?? 0) > 10} />
        )}
      </section>
    </div>
  )
}

function SelectedOpdStrip({
  opdName,
  onChangeOpd,
}: {
  opdName: string
  onChangeOpd: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-subtle/80 px-2 py-2 sm:px-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
        <Building2 className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{opdName}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 px-2 text-xs text-blue-700 hover:bg-blue-50"
        onClick={onChangeOpd}
      >
        Ganti OPD
      </Button>
    </div>
  )
}

function PreviewEmptyState({
  showSopList,
  hasManySops,
}: {
  showSopList: boolean
  hasManySops: boolean
}) {
  return (
    <section className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-base font-medium text-foreground">Pratinjau dokumen</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {showSopList
          ? hasManySops
            ? 'Pilih SOP di daftar kiri, atau gunakan filter di atas daftar.'
            : 'Pilih SOP di panel kiri untuk membaca dokumen di sini.'
          : 'Pilih OPD di panel kiri, lalu pilih SOP untuk membuka pratinjau.'}
      </p>
    </section>
  )
}

function SopListPickOpdHint() {
  return (
    <p className="p-4 text-center text-sm text-muted-foreground">
      Pilih OPD di atas untuk menampilkan daftar SOP.
    </p>
  )
}
