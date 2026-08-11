import { Link } from '@tanstack/react-router'
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import logoSvg from '@/assets/logo.svg'
import { APP_DISPLAY_NAME } from '@/config/env'
import { cn } from '@/utils/cn'

export interface AppSidebarItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface AppSidebarProps {
  items: AppSidebarItem[]
  isItemActive: (to: string) => boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

function RailTooltip({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-tooltip hidden -translate-y-1/2 whitespace-nowrap rounded-control bg-foreground px-2 py-1.5 text-xs font-medium text-surface shadow-raised group-hover:block group-focus-visible:block"
    >
      {children}
    </span>
  )
}

/**
 * Sidebar global aplikasi.
 * Expanded: 256px untuk label menu. Collapsed: navigation rail 56px sesuai design token.
 */
export function AppSidebar({
  items,
  isItemActive,
  open,
  onOpenChange,
}: AppSidebarProps) {
  const collapsed = !open

  return (
    <aside
      id="desktop-sidebar"
      data-print-hide
      data-state={collapsed ? 'collapsed' : 'expanded'}
      className={cn(
        'relative hidden flex-shrink-0 flex-col bg-surface transition-[width] duration-200 motion-reduce:transition-none md:flex',
        collapsed
          ? 'w-[var(--sidebar-width)]'
          : 'w-[var(--sidebar-width-expanded)]',
      )}
    >
      <div
        className={cn(
          'flex h-[var(--header-height)] shrink-0 items-center border-b border-border',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-3',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            className="group relative inline-flex h-9 w-9 items-center justify-center rounded-control text-secondary-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Perluas navigasi"
            aria-expanded={false}
            aria-controls="desktop-sidebar"
            onClick={() => onOpenChange(true)}
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            <RailTooltip>Perluas navigasi</RailTooltip>
          </button>
        ) : (
          <>
            <img src={logoSvg} alt="" aria-hidden className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-ui-body font-semibold text-foreground">
                {APP_DISPLAY_NAME}
              </p>
            </div>
            <button
              type="button"
              className="group relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-secondary-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Ciutkan navigasi"
              aria-expanded={true}
              aria-controls="desktop-sidebar"
              onClick={() => onOpenChange(false)}
            >
              <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              <RailTooltip>Ciutkan navigasi</RailTooltip>
            </button>
          </>
        )}
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 scrollbar-hide"
        aria-label="Navigasi utama"
      >
        <div className="flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = isItemActive(to)
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  'group relative flex min-h-10 w-full items-center rounded-control text-ui-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                  collapsed ? 'justify-center px-0' : 'gap-2.5 px-3 py-2',
                  active
                    ? 'bg-primary-subtle font-semibold text-primary'
                    : 'text-secondary-foreground hover:bg-surface-muted hover:text-foreground',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                <span className={cn('min-w-0 whitespace-normal break-words leading-5', collapsed && 'sr-only')}>
                  {label}
                </span>
                {collapsed ? <RailTooltip>{label}</RailTooltip> : null}
              </Link>
            )
          })}
        </div>
      </nav>

    </aside>
  )
}
