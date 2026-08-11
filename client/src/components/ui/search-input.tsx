import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'

interface SearchInputProps extends Omit<React.ComponentProps<typeof Input>, 'className'> {
  className?: string
  inputClassName?: string
}

export function SearchInput({ className, inputClassName, ...props }: SearchInputProps) {
  const ariaLabel =
    props['aria-label'] ?? (typeof props.placeholder === 'string' ? props.placeholder : undefined)

  return (
    <div className={cn('relative flex-1 max-w-md', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        className={cn('pl-9 pr-3 text-ui-body', inputClassName)}
        aria-label={ariaLabel}
        {...props}
      />
    </div>
  )
}
