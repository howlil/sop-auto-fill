/**
 * Picker skor 1–5 (untuk evaluasi OPD).
 */
import { FormField } from '@/components/ui/form-field'
import { useRef, type KeyboardEvent } from 'react'

const SKOR_OPTIONS = [1, 2, 3, 4, 5] as const

const SKOR_LABELS: Record<(typeof SKOR_OPTIONS)[number], string> = {
  1: 'Sangat rendah',
  2: 'Rendah',
  3: 'Sedang',
  4: 'Tinggi',
  5: 'Sangat tinggi',
}

export interface SkorRatingPickerProps {
  value: number | null
  onChange: (value: number) => void
  label?: string
  hint?: string
  disabled?: boolean
}

export function SkorRatingPicker({
  value,
  onChange,
  label = 'Nilai evaluasi OPD (1–5)',
  hint = 'Setiap evaluasi SOP dapat disertai nilai evaluasi OPD.',
  disabled = false,
}: SkorRatingPickerProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % SKOR_OPTIONS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + SKOR_OPTIONS.length) % SKOR_OPTIONS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = SKOR_OPTIONS.length - 1
    }
    if (nextIndex == null) return
    event.preventDefault()
    const nextValue = SKOR_OPTIONS[nextIndex]
    if (nextValue == null) return
    onChange(nextValue)
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <FormField label={label}>
      <div
        className="flex flex-wrap justify-center gap-1.5"
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
      >
        {SKOR_OPTIONS.map((n, index) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            tabIndex={value === n || (value === null && index === 0) ? 0 : -1}
            ref={(node) => {
              optionRefs.current[index] = node
            }}
            disabled={disabled}
            aria-label={`${n} - ${SKOR_LABELS[n]}`}
            title={`${n} - ${SKOR_LABELS[n]}`}
            onClick={() => {
              if (!disabled) {
                onChange(n);
              }
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`w-9 h-9 rounded-md border text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              value === n
                ? 'border-primary bg-primary-subtle text-primary'
                : 'border-border-strong bg-surface text-secondary-foreground hover:bg-surface-subtle'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
        <p className="text-[11px] font-medium text-blue-900">
          Arti nilai: 1 adalah nilai terendah dan 5 adalah nilai tertinggi.
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-blue-800">
          1 = Sangat rendah · 2 = Rendah · 3 = Sedang · 4 = Tinggi · 5 = Sangat tinggi
        </p>
      </div>
    </FormField>
  )
}
