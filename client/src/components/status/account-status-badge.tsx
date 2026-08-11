import {
  getAccountStatusColors,
  getAccountStatusLabel,
} from '@/lib/status/account-status.config'
import { DomainStatusBadge } from './domain-status-badge'

export interface AccountStatusBadgeProps {
  status: string
  label?: string
  className?: string
  showDomain?: boolean
}

export function AccountStatusBadge({
  status,
  label,
  className,
  showDomain = false,
}: AccountStatusBadgeProps) {
  return (
    <DomainStatusBadge
      domainLabel="Akun"
      label={label ?? getAccountStatusLabel(status)}
      colors={getAccountStatusColors(status)}
      className={className}
      showDomain={showDomain}
    />
  )
}
