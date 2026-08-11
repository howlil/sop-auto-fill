import type { ReactNode } from 'react'
import { ChevronDown, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/utils/cn'

export interface FilterDropdownButtonProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeCount?: number
  label?: string
  children: ReactNode
  contentClassName?: string
}

export function FilterDropdownButton({
  open,
  onOpenChange,
  activeCount = 0,
  label = 'Filter',
  children,
  contentClassName,
}: FilterDropdownButtonProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          {label}
          {activeCount > 0 ? (
            <Badge className="bg-blue-600 text-white text-xs px-1.5 py-0 h-4 min-w-[16px] border-0">
              {activeCount}
            </Badge>
          ) : null}
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('w-80 p-3', contentClassName)}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
