import { useCallback, useMemo } from 'react'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/utils/cn'

export interface GrafikEvaluasiTahunPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tahunMin: number
  tahunMax: number
  selectedYear: number
  onSelectYear: (year: number) => void
}

export function GrafikEvaluasiTahunPicker({
  open,
  onOpenChange,
  tahunMin,
  tahunMax,
  selectedYear,
  onSelectYear,
}: GrafikEvaluasiTahunPickerProps) {
  const clampY = useCallback(
    (y: number) => Math.min(tahunMax, Math.max(tahunMin, Math.round(y))),
    [tahunMin, tahunMax],
  )
  const yearsDesc = useMemo(() => {
    const out: number[] = []
    for (let y = tahunMax; y >= tahunMin; y--) out.push(y)
    return out
  }, [tahunMin, tahunMax])
  const activeYear = clampY(selectedYear)
  const handlePick = useCallback(
    (y: number) => {
      onSelectYear(clampY(y))
      onOpenChange(false)
    },
    [clampY, onSelectYear, onOpenChange],
  )
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 min-w-[10.5rem] justify-start gap-2 px-3 text-xs font-normal"
          aria-label="Buka pemilih tahun"
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="tabular-nums text-foreground">{activeYear}</span>
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="max-h-64 w-auto min-w-[240px] overflow-y-auto border border-border bg-surface p-0 shadow-md"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="sticky top-0 z-10 border-b border-border bg-surface px-3 py-2">
          <p className="text-xs font-semibold text-foreground">Tahun</p>
          <p className="text-[11px] text-muted-foreground">
            Pilih tahun ({tahunMin}–{tahunMax}).
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1 p-2">
          {yearsDesc.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => handlePick(y)}
              className={cn(
                'rounded-md border px-1.5 py-2 text-xs tabular-nums transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                y === activeYear
                  ? 'border-blue-500 bg-blue-50 font-semibold text-blue-800'
                  : 'border-border-strong text-foreground hover:bg-surface-subtle',
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
