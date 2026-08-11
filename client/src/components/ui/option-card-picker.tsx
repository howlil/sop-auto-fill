import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { FormField } from '@/components/ui/form-field'
import { cn } from '@/utils/cn'

export type OptionCardVariant = 'success' | 'warning' | 'neutral' | 'info'

export interface OptionCardOption<T> {
  value: T
  label: string
  description?: string
  icon?: ReactNode
  variant?: OptionCardVariant
}

const VARIANT_STYLES: Record<OptionCardVariant, { selected: string; icon: string; label: string }> = {
  success: {
    selected: 'border-success bg-success-subtle',
    icon: 'text-success-foreground',
    label: 'text-success-foreground',
  },
  warning: {
    selected: 'border-warning bg-warning-subtle',
    icon: 'text-warning-foreground',
    label: 'text-warning-foreground',
  },
  neutral: {
    selected: 'border-border-strong bg-surface-muted',
    icon: 'text-secondary-foreground',
    label: 'text-secondary-foreground',
  },
  info: {
    selected: 'border-primary bg-primary-subtle',
    icon: 'text-primary',
    label: 'text-info-foreground',
  },
}

const BASE_OPTION_CLASS =
  'w-full rounded-surface border border-border-strong bg-surface p-card text-left transition-all hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
const UNSELECTED_LABEL = 'text-secondary-foreground'
const UNSELECTED_ICON = 'text-muted-foreground'

export interface OptionCardPickerProps<T> {
  /** Opsi yang bisa dipilih (value, label, deskripsi, icon, variant warna) */
  options: OptionCardOption<T>[]
  /** Nilai terpilih */
  value: T | null
  /** Callback saat opsi dipilih */
  onChange: (value: T) => void
  /** Label form (optional; jika tidak ada, tidak pakai FormField wrapper) */
  label?: ReactNode
  required?: boolean
  /** Layout: grid cols */
  columns?: 2 | 3 | 4
  className?: string
  /** Class untuk tiap kartu opsi */
  optionClassName?: string
  /** Nonaktifkan interaksi (mis. belum ada pengajuan evaluasi di server) */
  disabled?: boolean
}

function isEqual<T>(a: T | null, b: T): boolean {
  if (a === null) return false
  return a === b
}

/**
 * Picker berbasis kartu: beberapa opsi dengan icon + label + deskripsi, satu yang terpilih.
 * Agnostic terhadap domain; konten dan value sepenuhnya dari props.
 */
export function OptionCardPicker<T>({
  options,
  value,
  onChange,
  label,
  required,
  columns = 2,
  className,
  optionClassName,
  disabled = false,
}: OptionCardPickerProps<T>) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns]

  const handleRadioKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled || options.length === 0) return
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = options.length - 1
    }
    if (nextIndex == null) return
    event.preventDefault()
    const nextOption = options[nextIndex]
    if (!nextOption) return
    onChange(nextOption.value)
    optionRefs.current[nextIndex]?.focus()
  }

  const content = (
    <div
      className={cn('grid gap-2', gridClass, className)}
      role="radiogroup"
      aria-label={typeof label === 'string' ? label : 'Pilih satu opsi'}
      aria-required={required || undefined}
      aria-disabled={disabled || undefined}
    >
      {options.map((opt, index) => {
        const selected = isEqual(value, opt.value)
        const variant = opt.variant ?? 'neutral'
        const styles = VARIANT_STYLES[variant]
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (value === null && index === 0) ? 0 : -1}
            ref={(node) => {
              optionRefs.current[index] = node
            }}
            disabled={disabled}
            className={cn(
              BASE_OPTION_CLASS,
              selected ? styles.selected : '',
              optionClassName,
              disabled && 'opacity-50 cursor-not-allowed hover:bg-surface',
            )}
            onClick={() => {
              if (!disabled) {
                onChange(opt.value);
              }
            }}
            onKeyDown={(event) => handleRadioKeyDown(event, index)}
          >
            {opt.icon && (
              <div
                className={cn(
                  'w-6 h-6 mx-auto mb-1 flex items-center justify-center',
                  selected ? styles.icon : UNSELECTED_ICON
                )}
              >
                {opt.icon}
              </div>
            )}
            <span
              className={cn(
                'text-xs font-semibold block',
                selected ? styles.label : UNSELECTED_LABEL
              )}
            >
              {opt.label}
            </span>
            {opt.description && (
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {opt.description}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  if (label != null) {
    return (
      <FormField label={label} required={required}>
        {content}
      </FormField>
    )
  }

  return content
}
