import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface BackButtonProps {
  to?: string
  onClick?: () => void
  children?: React.ReactNode
  size?: 'sm' | 'icon'
  className?: string
}

const defaultLabel = 'Kembali'

export function BackButton({ to, onClick, children, size, className }: BackButtonProps) {
  const label = children ?? defaultLabel
  const iconOnly = size === 'icon' || children === undefined

  const content = (
    <>
      <ArrowLeft className={iconOnly ? 'w-4 h-4' : 'w-3.5 h-3.5 mr-1'} />
      {!iconOnly && label}
    </>
  )

  const button = (
    <Button
      type="button"
      variant={iconOnly ? 'ghost' : 'outline'}
      size={iconOnly ? 'icon' : 'sm'}
      className={className}
      onClick={onClick}
      title={iconOnly ? (typeof label === 'string' ? label : defaultLabel) : undefined}
    >
      {content}
    </Button>
  )

  if (to) {
    return <Link to={to}>{button}</Link>
  }
  return button
}
