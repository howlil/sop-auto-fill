import * as React from 'react'
import { cn } from '@/utils/cn'
import { BackButton } from '@/components/ui/back-button'
import { SetPageHeader } from '@/components/layout/PageHeaderProvider'
import type { BreadcrumbItem } from '@/components/ui/breadcrumb'

// ========================
// DetailWorkspace (internal)
// ========================

interface DetailWorkspaceProps {
  /** Tambahan class untuk root (e.g. print:hidden) */
  className?: string
  /** Optional: header/toolbar atau blok info di atas (border-b) */
  header?: React.ReactNode
  /** Optional: panel kiri; jika ada = layout 3 kolom (kiri | main | kanan) */
  leftPanel?: React.ReactNode
  /** Konten panel utama (SOP preview / diagram / form) */
  main: React.ReactNode
  /** Panel kanan (biasanya CollapsibleSidePanel) */
  rightPanel?: React.ReactNode
}

function DetailWorkspace({
  className,
  header,
  leftPanel,
  main,
  rightPanel,
}: DetailWorkspaceProps) {
  return (
    <div
      className={cn(
        // Workspace shell: subtle depth + calmer background (main content tetap putih).
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-surface border border-border bg-surface shadow-surface',
        className
      )}
    >
      {header != null && (
        <div
          data-print-hide
          className="flex-shrink-0 border-b border-border bg-surface px-4 py-3 sm:px-5"
        >
          {header}
        </div>
      )}
      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {leftPanel != null && (
          <div
            data-print-hide
            className="flex flex-col h-full max-h-[min(46vh,340px)] shrink-0 overflow-hidden border-b border-border bg-surface-subtle lg:max-h-none lg:max-w-[min(300px,30vw)] lg:border-b-0 lg:border-r"
          >
            {leftPanel}
          </div>
        )}
        <div className="flex min-h-[40vh] min-w-0 flex-1 flex-col overflow-hidden bg-surface p-3 sm:p-4 lg:border-r lg:border-border">
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {main}
          </div>
        </div>
        {rightPanel != null && (
          <div
            data-print-hide
            className="flex flex-col h-full max-h-[min(52vh,440px)] shrink-0 overflow-hidden border-t border-border bg-surface-subtle lg:max-h-none lg:max-w-[min(340px,28vw)] lg:border-l lg:border-t-0"
          >
            {rightPanel}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * DetailPageLayoutProps - Props for detail page layout
 * 
 * Standard layout for detail pages with:
 * - Page header with back button
 * - Workspace with main content + optional side panels
 * - Responsive 2-column or 3-column layout
 */
export interface DetailPageLayoutProps {
  /** Item breadcrumb. Opsional: null/undefined = tidak tampil breadcrumb. */
  breadcrumb?: BreadcrumbItem[] | null
  title: string
  description?: string
  /** Route atau path untuk tombol kembali */
  backTo: string
  /** Ukuran tombol kembali: 'icon' = hanya ikon, default = teks "Kembali" */
  backSize?: 'default' | 'icon'
  /** Aksi di header (tombol, badge) */
  actions?: React.ReactNode
  /** Blok header di dalam workspace (info, toolbar) */
  header?: React.ReactNode
  /** Konten utama */
  main?: React.ReactNode
  /** Alias for main - used in some pages */
  children?: React.ReactNode
  /** Panel kiri (opsional) */
  leftPanel?: React.ReactNode
  /** Panel kanan (opsional) */
  rightPanel?: React.ReactNode
  className?: string
  workspaceClassName?: string
}

/**
 * DetailPageLayout - Standard layout for detail pages
 * 
 * Used in:
 * - DetailSOP
 * - DetailVerifikasiBatch
 * - DetailSOPPenyusun
 * - PelaksanaanEvaluasi
 * 
 * Layout modes:
 * - 2 columns: main + rightPanel (SOP detail, Kepala OPD view)
 * - 3 columns: leftPanel + main + rightPanel (Evaluation assignment)
 * 
 * @example
 * ```tsx
 * <DetailPageLayout
 *   title="Detail SOP"
 *   backTo="/sop-saya"
 *   main={<SOPPreview />}
 *   rightPanel={<ActivityPanel />}
 * />
 * ```
 */
export function DetailPageLayout({
  breadcrumb,
  title,
  backTo,
  backSize = 'icon',
  actions,
  header,
  main,
  children,
  leftPanel,
  rightPanel,
  className,
  workspaceClassName,
}: DetailPageLayoutProps) {
  const mainContent = main ?? children
  return (
    <div suppressHydrationWarning className={className ?? 'flex h-[calc(100vh-5rem)] min-h-0 flex-col gap-3 sm:gap-4'}>
      <div suppressHydrationWarning data-print-hide>
      <SetPageHeader
        breadcrumb={breadcrumb ?? []}
        title={title}
        leading={
          backSize === 'icon' ? (
            <BackButton size="icon" to={backTo} />
          ) : (
            <BackButton to={backTo} />
          )
        }
        actions={actions}
      />
      </div>
      <DetailWorkspace
        className={workspaceClassName}
        header={header}
        leftPanel={leftPanel}
        main={mainContent}
        rightPanel={rightPanel}
      />
    </div>
  )
}

