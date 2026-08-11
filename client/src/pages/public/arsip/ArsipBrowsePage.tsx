import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { cn } from '@/utils/cn'
import {
  ArsipBreadcrumb,
  ArsipHeroSearch,
  ArsipPageIntro,
  ArsipSopShell,
} from './components/arsip-chrome'
import { ArsipBrowseWorkspace } from './components/arsip-browse-workspace'
import { ArsipOpdSidebar } from './components/arsip-opd-sidebar'
import { ArsipSopPanel } from './components/arsip-sop-panel'
import { ArsipSopPreviewPane } from './components/arsip-sop-preview-pane'
import { useArsipBrowse } from './hooks/use-arsip-browse'

export function ArsipBrowsePage() {
  const browse = useArsipBrowse()
  useDocumentTitle('Arsip SOP — Telusuri Dokumen')
  const { workspaceProps } = browse
  const handleCloseMobilePreview = () => {
    const selectedId = browse.mobile.detailSopId
    browse.handleClosePreview()

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const candidates = document.querySelectorAll<HTMLElement>('[data-arsip-sop-id]')
        const trigger = Array.from(candidates).find(
          (candidate) =>
            candidate.dataset.arsipSopId === selectedId && candidate.offsetParent !== null,
        )
        trigger?.focus()
      })
    })
  }
  return (
    <ArsipSopShell>
      <ArsipPageIntro />
      <ArsipHeroSearch value={browse.globalInput} onChange={browse.setGlobalInput} />
      {browse.showBreadcrumb ? <ArsipBreadcrumb items={browse.breadcrumbItems} /> : null}
      <ArsipBrowseWorkspace {...workspaceProps} />
      <div className={cn('mt-4 space-y-4 lg:hidden', browse.mobile.showPreview && 'hidden')}>
        {browse.mobile.showOpd ? (
          <ArsipOpdSidebar
            items={workspaceProps.opdItems}
            selectedOpdId={workspaceProps.opdId}
            opdFilter={workspaceProps.opdFilter}
            onOpdFilterChange={workspaceProps.onOpdFilterChange}
            onSelectOpd={browse.handleSelectOpd}
            isLoading={workspaceProps.opdLoading}
            isError={workspaceProps.opdError}
            isFetching={workspaceProps.opdFetching}
            pagination={workspaceProps.opdPagination}
            page={workspaceProps.opdPage}
            onPageChange={browse.handleOpdPageChange}
          />
        ) : null}
        {browse.mobile.showSopList ? (
          <>
            {!browse.mobile.isGlobalMode ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 px-0 text-blue-700 hover:bg-transparent hover:underline"
                onClick={browse.handleMobileBackToOpd}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Kembali ke daftar OPD
              </Button>
            ) : null}
            <ArsipSopPanel
              title={browse.panelTitle}
              subtitle={browse.panelSubtitle}
              items={browse.sopItems}
              pagination={browse.sopPagination}
              page={browse.sopPage}
              onPageChange={browse.handleSopPageChange}
              isLoading={browse.sopLoading}
              isError={browse.sopError}
              isFetching={browse.sopFetching}
              showOpdColumn={browse.isGlobalMode}
              selectedDetailSopId={browse.mobile.detailSopId}
              onSelectSop={browse.handleSelectSop}
              emptyTitle={browse.sopEmptyTitle}
              emptyHint={browse.sopEmptyHint}
              showSopSearchFilter={Boolean(browse.opdId) && !browse.isGlobalMode}
              sopSearch={browse.sopFilterInput}
              onSopSearchChange={browse.handleSopSearchChange}
            />
          </>
        ) : null}
      </div>
      {browse.mobile.showPreview && browse.mobile.detailSopId ? (
        <div className="lg:hidden">
          <ArsipSopPreviewPane
            detailSopId={browse.mobile.detailSopId}
            pdfUrl={browse.selectedSop?.pdfUrl}
            title={browse.selectedSop?.judul}
            opdName={browse.selectedSop?.opdNama}
            onClose={handleCloseMobilePreview}
            onRefresh={browse.workspaceProps.onRefreshPreview}
            variant="overlay"
          />
        </div>
      ) : null}
    </ArsipSopShell>
  )
}
