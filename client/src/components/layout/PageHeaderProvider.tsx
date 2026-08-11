import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BreadcrumbItem } from '@/components/ui/breadcrumb'

/**
 * PageHeaderContent - Header content structure
 *
 * Used by PageHeaderProvider to manage header state across layout.
 * Content is set by SetPageHeader component, displayed by HeaderBar.
 */
export interface PageHeaderContent {
  breadcrumb: BreadcrumbItem[]
  title: string
  leading?: ReactNode
  actions?: ReactNode
}

interface PageHeaderContextValue {
  headerContent: PageHeaderContent | null
  setHeaderContent: (content: PageHeaderContent | null) => void
}

/**
 * PageHeaderProvider - Context for managing page header content
 *
 * Provides a way for pages to declaratively set header content
 * without prop drilling through layout layers.
 *
 * @example
 * ```tsx
 * // In DashboardLayout (provider)
 * <PageHeaderProvider>
 *   <HeaderBar />
 *   <Outlet />
 * </PageHeaderProvider>
 *
 * // In page component (consumer)
 * <SetPageHeader
 *   breadcrumb={[{ label: 'Home' }]}
 *   title="Dashboard"
 *   actions={<Button>Action</Button>}
 * />
 * ```
 */
const PageHeaderContext = createContext<PageHeaderContextValue | null>(null)

/**
 * PageHeaderProvider - Provides header context to component tree
 *
 * Must wrap RoleLayout or similar layout component.
 * Stores header content state and provides setter via context.
 */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<PageHeaderContent | null>(null)
  const stableSetter = useCallback((content: PageHeaderContent | null) => {
    setHeaderContent(content)
  }, [])
  const value = useMemo(() => ({ headerContent, setHeaderContent: stableSetter }), [headerContent, stableSetter])
  return (
    <PageHeaderContext.Provider value={value}>
      {children}
    </PageHeaderContext.Provider>
  )
}

/**
 * usePageHeaderContext - Hook to access header context
 *
 * @returns Context value with headerContent and setHeaderContent
 * @returns null if used outside PageHeaderProvider
 *
 * @example
 * ```tsx
 * const ctx = usePageHeaderContext()
 * if (ctx) {
 *   ctx.setHeaderContent({ breadcrumb: [], title: 'New Title' })
 * }
 * ```
 */
export function usePageHeaderContext() {
  const ctx = useContext(PageHeaderContext)
  return ctx
}

// ========================
// SetPageHeader
// ========================

export interface SetPageHeaderProps {
  /** Item breadcrumb (urutan: parent → current). Item terakhir = halaman saat ini (boleh tanpa `to`) */
  breadcrumb: BreadcrumbItem[]
  /** Judul halaman */
  title: string
  /** Konten di kiri (sebelah kiri judul), mis. tombol kembali */
  leading?: ReactNode
  /** Konten tambahan di kanan (tombol aksi, dll.) */
  actions?: ReactNode
  className?: string
}

/**
 * SetPageHeader - Declarative header content setter
 *
 * Sets header content (breadcrumb, title, actions) via PageHeaderProvider.
 * Renders nothing (null) - only updates context for HeaderBar to display.
 */
export function SetPageHeader({
  breadcrumb,
  title,
  leading,
  actions,
}: SetPageHeaderProps) {
  const ctx = usePageHeaderContext()
  const propsRef = useRef({ breadcrumb, title, leading, actions })
  propsRef.current = { breadcrumb, title, leading, actions }

  const breadcrumbKey = JSON.stringify(breadcrumb)
  const setHeader = ctx?.setHeaderContent
  const setHeaderRef = useRef(setHeader)
  setHeaderRef.current = setHeader

  useEffect(() => {
    if (!setHeaderRef.current) return
    setHeaderRef.current(propsRef.current)
    return () => {
      setHeaderRef.current?.(null)
    }
  }, [breadcrumbKey, title])

  return null
}
