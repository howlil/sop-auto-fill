/**
 * Daftar riwayat dalam bentuk card (untuk riwayat evaluasi SOP / OPD).
 */
import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export interface RiwayatCardListProps<T> {
  title: string
  emptyMessage: string
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}

export function RiwayatCardList<T>({
  title,
  emptyMessage,
  items,
  renderItem,
  className,
}: RiwayatCardListProps<T>) {
  return (
    <div className={className}>
      <h4 className="text-xs font-semibold text-secondary-foreground mb-2">{title}</h4>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <Card key={i}>
              <CardContent className="p-2.5 text-[11px]">
                {renderItem(item, i)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
