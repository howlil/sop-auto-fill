import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'

export type CollapsibleSidePanelSide = 'left' | 'right'

export interface CollapsibleSidePanelTab {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
}

export interface CollapsibleSidePanelProps {
  side: CollapsibleSidePanelSide
  collapsed: boolean
  widthCollapsed?: string
  widthExpanded: string
  className?: string
  children: React.ReactNode
}

export const CollapsibleSidePanel = React.forwardRef<HTMLDivElement, CollapsibleSidePanelProps>(
  (
    {
      side,
      collapsed,
      widthCollapsed = 'w-12',
      widthExpanded,
      className,
      children,
    },
    ref
  ) => {
    const isRight = side === 'right'

    return (
      <div
        ref={ref}
        data-state={collapsed ? 'collapsed' : 'expanded'}
        className={cn(
          'flex h-full flex-shrink-0 flex-col overflow-hidden bg-surface transition-[width] duration-200 motion-reduce:transition-none',
          isRight ? 'border-l border-border' : 'border-r border-border',
          collapsed ? widthCollapsed : widthExpanded,
          className
        )}
      >
        {children}
      </div>
    )
  }
)
CollapsibleSidePanel.displayName = 'CollapsibleSidePanel'

/* ─── Composable sub-components for new code ────────────────────────────── */

export interface CollapsedStripButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  label?: string
  /** Alias for `title` (HTML attribute) with clearer intent */
  tooltip?: string
}

export const CollapsedStripButton = React.forwardRef<HTMLButtonElement, CollapsedStripButtonProps>(
  ({ icon, label, tooltip, title: htmlTitle, className, 'aria-label': ariaLabel, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      className={cn('h-full w-full flex flex-col items-center justify-center gap-1 rounded-none border-0 py-4 min-h-0', className)}
      title={tooltip ?? htmlTitle ?? label ?? 'Buka panel'}
      aria-label={ariaLabel ?? label ?? tooltip ?? htmlTitle ?? 'Buka panel'}
      aria-expanded={false}
      {...props}
    >
      {icon}
      {label && (
        <span className="text-[10px] text-muted-foreground leading-tight max-w-full truncate">
          {label}
        </span>
      )}
    </Button>
  )
)
CollapsedStripButton.displayName = 'CollapsedStripButton'

export interface CollapsibleSidePanelHeaderProps {
  side: CollapsibleSidePanelSide
  onCollapse: () => void
  className?: string
  children: React.ReactNode
}

export function CollapsibleSidePanelHeader({
  side,
  onCollapse,
  className,
  children,
}: CollapsibleSidePanelHeaderProps) {
  const isRight = side === 'right'
  const ChevronIcon = isRight ? ChevronRight : ChevronLeft

  return (
    <div className={cn('flex items-center gap-2 flex-shrink-0 p-2 justify-between border-b border-border', className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 shrink-0"
        onClick={onCollapse}
        aria-label={isRight ? 'Sembunyikan panel kanan' : 'Sembunyikan panel kiri'}
        aria-expanded="true"
        title={isRight ? 'Sembunyikan panel kanan' : 'Sembunyikan panel kiri'}
      >
        <ChevronIcon className="w-4 h-4" />
      </Button>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}

export interface SimplePanelHeaderProps {
  title: string
  subtitle?: React.ReactNode
}

export function SimplePanelHeader({ title, subtitle }: SimplePanelHeaderProps) {
  return (
    <div className="min-w-0">
      <h3 className="truncate text-xs font-semibold text-secondary-foreground" title={title}>{title}</h3>
      {subtitle != null && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
    </div>
  )
}

export interface PanelTab {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
}

export interface PanelTabStripProps {
  tabs: PanelTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  ariaLabel?: string
}

export function PanelTabStrip({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel = 'Bagian panel',
}: PanelTabStripProps) {
  const baseId = React.useId()
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  const moveSelection = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (tabs.length === 0) return

    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === undefined) return

    event.preventDefault()
    onTabChange(tabs[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div
      className="flex min-w-0 flex-1 gap-0.5 rounded-md bg-surface-muted p-0.5"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            id={`${baseId}-tab-${index}`}
            type="button"
            title={tab.label}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => moveSelection(event, index)}
            className={cn(
              'flex min-h-8 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              isActive
                ? 'flex-none shrink-0 bg-surface text-foreground shadow-surface'
                : 'flex-1 min-w-0 text-secondary-foreground hover:text-foreground'
            )}
          >
            {tab.icon && (
              <span className="shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                {tab.icon}
              </span>
            )}
            <span className={cn(isActive ? 'whitespace-nowrap' : 'sr-only')}>
              {tab.label}
            </span>
            {tab.badge && <span className="text-[10px] opacity-80">{tab.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

export interface CollapsibleSidePanelContentProps {
  className?: string
  children: React.ReactNode
}

export function CollapsibleSidePanelContent({ className, children }: CollapsibleSidePanelContentProps) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-auto overscroll-contain scrollbar-hide', className)}>
      {children}
    </div>
  )
}
