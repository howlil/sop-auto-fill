import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/utils/cn'

export interface PersonIdentityValue {
  namaLengkap?: string
  nama?: string
  name?: string
  nip: string
  email: string
  jabatan: string
  pangkat: string
  nohp?: string
  phone?: string
  status?: string
}

export interface PersonIdentityLabels {
  name?: string
  jabatan?: string
  pangkat?: string
}

export interface PersonIdentityFieldsProps<T extends PersonIdentityValue> {
  value: T
  onChange: React.Dispatch<React.SetStateAction<T>>
  showStatus?: boolean
  labels?: PersonIdentityLabels
  placeholders?: Partial<Record<'name' | 'nip' | 'email' | 'jabatan' | 'pangkat' | 'phone', string>>
  className?: string
}

const inputFieldClass =
  'border-border-strong text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary'

const STATUS_OPTIONS = [
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
]

function getName(value: PersonIdentityValue): string {
  return value.namaLengkap ?? value.nama ?? value.name ?? ''
}

function getPhone(value: PersonIdentityValue): string {
  return value.nohp ?? value.phone ?? ''
}

function setName<T extends PersonIdentityValue>(prev: T, name: string): T {
  if ('namaLengkap' in prev) return { ...prev, namaLengkap: name }
  if ('nama' in prev) return { ...prev, nama: name }
  return { ...prev, name }
}

function setPhone<T extends PersonIdentityValue>(prev: T, phoneValue: string): T {
  if ('nohp' in prev) return { ...prev, nohp: phoneValue }
  return { ...prev, phone: phoneValue }
}

export function PersonIdentityFields<T extends PersonIdentityValue>({
  value,
  onChange,
  showStatus = false,
  labels,
  placeholders,
  className,
}: PersonIdentityFieldsProps<T>) {
  return (
    <div className={cn('space-y-3', className)}>
      {showStatus ? (
        <FormField label="Status akun" required>
          <Select
            value={value.status ?? 'AKTIF'}
            onValueChange={(status) => onChange((prev) => ({ ...prev, status }))}
            options={STATUS_OPTIONS}
            placeholder="Pilih status"
          />
        </FormField>
      ) : null}
      <FormField label={labels?.name ?? 'Nama Lengkap'} required>
        <Input
          className={inputFieldClass}
          placeholder={placeholders?.name ?? 'Contoh: Ahmad Pratama, S.Sos'}
          value={getName(value)}
          onChange={(e) => onChange((prev) => setName(prev, e.target.value))}
        />
      </FormField>
      <FormField label="NIP" required>
        <Input
          className={cn(inputFieldClass, 'font-mono')}
          placeholder={placeholders?.nip ?? 'Contoh: 199203152020121001'}
          value={value.nip}
          onChange={(e) => onChange((prev) => ({ ...prev, nip: e.target.value }))}
        />
      </FormField>
      <FormField label={labels?.jabatan ?? 'Jabatan'} required>
        <Input
          className={inputFieldClass}
          placeholder={placeholders?.jabatan ?? 'Contoh: Kepala Seksi Organisasi'}
          value={value.jabatan}
          onChange={(e) => onChange((prev) => ({ ...prev, jabatan: e.target.value }))}
        />
      </FormField>
      <FormField label={labels?.pangkat ?? 'Pangkat / Golongan'} required>
        <Input
          className={inputFieldClass}
          placeholder={placeholders?.pangkat ?? 'Contoh: IV/a'}
          value={value.pangkat}
          onChange={(e) => onChange((prev) => ({ ...prev, pangkat: e.target.value }))}
        />
      </FormField>
      <FormField label="Email" required>
        <Input
          type="email"
          className={inputFieldClass}
          placeholder={placeholders?.email ?? 'Contoh: ahmad@pemda.go.id'}
          value={value.email}
          onChange={(e) => onChange((prev) => ({ ...prev, email: e.target.value }))}
        />
      </FormField>
      <FormField label="No. HP" required>
        <Input
          className={inputFieldClass}
          placeholder={placeholders?.phone ?? 'Contoh: 081234567890'}
          value={getPhone(value)}
          onChange={(e) => onChange((prev) => setPhone(prev, e.target.value))}
        />
      </FormField>
    </div>
  )
}
