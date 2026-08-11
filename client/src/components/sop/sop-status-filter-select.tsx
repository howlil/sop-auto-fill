/**
 * Select filter status SOP — satu komponen dengan STATUS_SOP_ALL (sesuai StatusBadge & types/sop).
 * Dipakai di Filter SOP (Manajemen SOP, Daftar SOP, SOP Saya).
 */
import { Select } from '@/components/ui/select'
import { SOP_STATUS_FILTER_OPTIONS } from '@/utils/constants'
import { cn } from '@/utils/cn'

export interface SOPStatusFilterSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function SOPStatusFilterSelect({
  id,
  value,
  onValueChange,
  className,
}: SOPStatusFilterSelectProps) {
  return (
    <Select
      id={id}
      className={cn('h-9 w-full', className)}
      value={value}
      onValueChange={onValueChange}
      options={[...SOP_STATUS_FILTER_OPTIONS]}
    />
  )
}
