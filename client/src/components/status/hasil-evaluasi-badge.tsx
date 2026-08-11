import { getHasilEvaluasiColors } from '@/lib/status/hasil-evaluasi.config'
import { DomainStatusBadge } from './domain-status-badge'

export interface HasilEvaluasiBadgeProps {
  hasil: string
  label: string
  className?: string
  showDomain?: boolean
}

export function HasilEvaluasiBadge({
  hasil,
  label,
  className,
  showDomain = true,
}: HasilEvaluasiBadgeProps) {
  return (
    <DomainStatusBadge
      domainLabel="Penilaian"
      label={label}
      colors={getHasilEvaluasiColors(hasil)}
      className={className}
      showDomain={showDomain}
    />
  )
}
