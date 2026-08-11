import type { BreadcrumbItem } from '@/components/ui/breadcrumb'
import { SetPageHeader } from '@/components/layout/PageHeaderProvider'

/**
 * ListPageLayoutProps - Props for list page layout
 * 
 * Standard layout for list pages with:
 * - Page header (breadcrumb, title, actions)
 * - Optional toolbar (search, filters)
 * - Main content (table, cards, etc.)
 */
export interface ListPageLayoutProps {
  /** Item breadcrumb. Opsional: null/undefined = tidak tampil breadcrumb. */
  breadcrumb?: BreadcrumbItem[] | null
  /** Judul halaman */
  title: string
  /** Deskripsi di bawah judul */
  description?: string
  /** Konten di kiri (mis. BackButton) */
  leading?: React.ReactNode
  /** Konten di kanan (tombol aksi) */
  actions?: React.ReactNode
  /** Toolbar di bawah header (mis. SearchToolbar dengan filter). Opsional. */
  toolbar?: React.ReactNode
  /** Konten utama (tabel, kartu, dll.) */
  children: React.ReactNode
  className?: string
}

/**
 * ListPageLayout - Standard layout for list pages
 * 
 * Used in:
 * - SOPSaya
 * - DaftarSOPEvaluasi
 * - DaftarSOP
 * - ManajemenEvaluator
 * 
 * @example
 * ```tsx
 * <ListPageLayout
 *   title="SOP Saya"
 *   description="Daftar SOP yang Anda susun"
 *   toolbar={<SearchToolbar />}
 *   actions={<Button>Buat SOP Baru</Button>}
 * >
 *   <SopTable />
 * </ListPageLayout>
 * ```
 */
export function ListPageLayout({
  breadcrumb,
  title,
  leading,
  actions,
  toolbar,
  children,
  className,
}: ListPageLayoutProps) {
  return (
    <div className={className ?? 'space-y-4 sm:space-y-section'}>
      <SetPageHeader
        breadcrumb={breadcrumb ?? []}
        title={title}
        leading={leading}
        actions={actions}
      />
      {toolbar}
      {children}
    </div>
  )
}
