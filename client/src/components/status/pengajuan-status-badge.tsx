import { getPengajuanStatusColors } from '@/lib/status/pengajuan-status.config'
import { DomainStatusBadge } from './domain-status-badge'

export interface PengajuanStatusBadgeProps {
  status: string
  label: string
  className?: string
  showDomain?: boolean
}

export function PengajuanStatusBadge({
  status,
  label,
  className,
  showDomain = true,
}: PengajuanStatusBadgeProps) {
  return (
    <DomainStatusBadge
      domainLabel="Pengajuan evaluasi"
      label={label}
      colors={getPengajuanStatusColors(status)}
      className={className}
      showDomain={showDomain}
    />
  )
}
