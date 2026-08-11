import { createContext, useContext, useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/utils/cn'

export interface FormFieldProps {
  /** Teks atau konten label (bisa string atau ReactNode untuk label dengan inline style) */
  label: ReactNode
  /** Field wajib diisi → tampil " *" di label */
  required?: boolean
  /** Kontrol (Input, Select, Textarea, dll.) */
  children: React.ReactNode
  className?: string
  /** Id elemen kontrol untuk a11y (htmlFor pada label) */
  htmlFor?: string
  /** Label secondary/muted (gray-500) */
  variant?: 'default' | 'muted'
}

interface FormFieldContextValue {
  labelId: string
  required: boolean
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null)

/** Dipakai kontrol form bersama untuk memperoleh accessible name dan required state. */
export function useFormFieldContext() {
  return useContext(FormFieldContext)
}

/**
 * Satu baris form: label + kontrol. Spacing konsisten (space-y-1.5).
 * Gunakan untuk form filter, dialog, form wizard.
 */
export function FormField({
  label,
  required,
  children,
  className,
  htmlFor,
  variant = 'default',
}: FormFieldProps) {
  const generatedId = useId()
  const labelId = `form-field-label-${generatedId}`

  return (
    <FormFieldContext.Provider value={{ labelId, required: Boolean(required) }}>
      <div className={cn('space-y-1.5', className)}>
        <Label id={labelId} required={required} variant={variant} htmlFor={htmlFor}>
          {label}
        </Label>
        {children}
      </div>
    </FormFieldContext.Provider>
  )
}
