import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/utils/cn'

export interface DocumentPreviewTab<TValue extends string = string> {
  value: TValue
  label: ReactNode
  content: ReactNode
  contentClassName?: string
}

export interface DocumentPreviewTabsProps<TValue extends string = string> {
  value: TValue
  onValueChange: (value: TValue) => void
  tabs: DocumentPreviewTab<TValue>[]
  className?: string
  headerClassName?: string
  listClassName?: string
  triggerClassName?: string
  ariaLabel?: string
}

export function DocumentPreviewTabs<TValue extends string = string>({
  value,
  onValueChange,
  tabs,
  className,
  headerClassName,
  listClassName,
  triggerClassName,
  ariaLabel = 'Pratinjau dokumen',
}: DocumentPreviewTabsProps<TValue>) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as TValue)}
      className={cn('flex h-full min-h-0 flex-col', className)}
    >
      <div
        data-print-hide
        className={cn('border-b border-border px-2 py-2', headerClassName)}
      >
        <TabsList
          className={cn('h-8 gap-2 bg-transparent p-0', listClassName)}
          aria-label={ariaLabel}
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn('h-8 text-xs', triggerClassName)}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className={cn(
            'mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden',
            tab.contentClassName,
          )}
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
