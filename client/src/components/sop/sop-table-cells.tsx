import { SopStatusBadge } from '@/components/status/sop-status-badge'
import { formatDateIdLong } from '@/utils/format-date'

export function SopPrimaryCell({ title }: { title: string }) {
  return <p className="font-medium text-foreground">{title}</p>
}

export function SopNumberCell({ value }: { value?: string | null }) {
  return <p className="text-secondary-foreground">{value ?? '-'}</p>
}

export function SopVersionCell({ value }: { value?: number | null }) {
  return (
    <p className="font-mono text-secondary-foreground tabular-nums">
      {value != null ? `V${value}` : '-'}
    </p>
  )
}

export function SopUpdatedByCell({
  name,
  date,
}: {
  name?: string | null
  date?: string | null
}) {
  if (name == null && date == null) {
    return <p className="text-muted-foreground text-xs">-</p>
  }

  return (
    <div>
      <p className="text-foreground">{name ?? '-'}</p>
      {date ? (
        <p className="text-muted-foreground text-xs mt-0.5">{formatDateIdLong(date)}</p>
      ) : null}
    </div>
  )
}

export function SopDateCell({ date }: { date?: string | null }) {
  return <p className="text-secondary-foreground">{date ? formatDateIdLong(date) : '-'}</p>
}

export function SopStatusCell({
  status,
  label,
}: {
  status: string
  label?: string
}) {
  return <SopStatusBadge status={status} label={label ?? status} showDomain={false} />
}
