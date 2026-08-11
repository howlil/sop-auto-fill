/**
 * Picker status hasil evaluasi: SESUAI | PERLU_PERBAIKAN (API enum Prisma).
 */
import { CheckCircle, XCircle } from 'lucide-react'
import { OptionCardPicker, type OptionCardOption } from '@/components/ui/option-card-picker'
import { STATUS_HASIL_EVALUASI } from '@/types/dto/evaluasi.dto'
import type { StatusHasilEvaluasi } from '@/types/dto/evaluasi.dto'

const OPTIONS: OptionCardOption<StatusHasilEvaluasi>[] = [
  {
    value: STATUS_HASIL_EVALUASI.SESUAI,
    label: 'Sesuai',
    icon: <CheckCircle className="w-6 h-6" />,
    variant: 'success',
  },
  {
    value: STATUS_HASIL_EVALUASI.PERLU_PERBAIKAN,
    label: 'Perlu Perbaikan',
    icon: <XCircle className="w-6 h-6" />,
    variant: 'warning',
  },
]

export interface StatusHasilEvaluasiPickerProps {
  value: StatusHasilEvaluasi | null
  onChange: (value: StatusHasilEvaluasi) => void
  disabled?: boolean
}

export function StatusHasilEvaluasiPicker({
  value,
  onChange,
  disabled = false,
}: StatusHasilEvaluasiPickerProps) {
  return (
    <OptionCardPicker<StatusHasilEvaluasi>
      options={OPTIONS}
      value={value}
      onChange={onChange}
      label="Hasil Evaluasi"
      required
      disabled={disabled}
    />
  )
}
