import { getSopStatusColors } from '@/lib/status/sop-status.config'
import { DomainStatusBadge } from './domain-status-badge'

export interface SopStatusBadgeProps {
  status: string
  label: string
  className?: string
  showDomain?: boolean
}

export function SopStatusBadge({
  status,
  label,
  className,
  showDomain = true,
}: SopStatusBadgeProps) {
  return (
    <DomainStatusBadge
      domainLabel="Dokumen"
      label={label}
      colors={getSopStatusColors(status)}
      className={className}
      showDomain={showDomain}
    />
  )
}
