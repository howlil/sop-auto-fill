import { PinDialog } from '@/components/security/pin-dialog'
import type { RegisterTteDto, TteProfil, UpdateTtePinDto } from '@/types/dto/tte.dto'
import { showErrorMessages } from '@/hooks/useToast'

export type TtePinDialogMode = 'create' | 'update'

export interface TtePinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: TtePinDialogMode
  namaRingkas: string
  nipRingkas: string
  profile?: TteProfil | null
  onRegisterTTE: (payload: RegisterTteDto) => Promise<unknown>
  onUpdateTTEPin: (payload: UpdateTtePinDto) => Promise<unknown>
}

export function TtePinDialog({
  open,
  onOpenChange,
  mode,
  namaRingkas,
  nipRingkas,
  profile,
  onRegisterTTE,
  onUpdateTTEPin,
}: TtePinDialogProps) {
  const displayNama = profile?.user?.nama ?? namaRingkas
  const displayNip = profile?.user?.nip ?? nipRingkas
  const title = mode === 'create' ? 'Atur PIN TTE' : 'Ubah PIN TTE'

  return (
    <PinDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      requireCurrentPin={mode === 'update'}
      requireConfirm
      pinLabel={mode === 'create' ? 'PIN TTE' : 'PIN baru'}
      pinPlaceholder="PIN untuk verifikasi"
      userSummary={
        <UserSummary
          displayNama={displayNama}
          displayNip={displayNip}
          email={profile?.user?.email}
        />
      }
      onSubmit={async ({ pin, currentPin }) => {
        if (mode === 'create') {
          await onRegisterTTE({ pin })
          return
        }
        await onUpdateTTEPin({ pinLama: currentPin ?? '', pinBaru: pin })
      }}
      onError={(err) =>
        showErrorMessages(
          err,
          mode === 'create' ? 'Gagal mengatur PIN TTE' : 'Gagal mengubah PIN TTE',
        )
      }
    />
  )
}

function UserSummary({
  displayNama,
  displayNip,
  email,
}: {
  displayNama: string
  displayNip: string
  email?: string
}) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-xs space-y-0.5">
      <p className="font-medium text-foreground">{displayNama || '-'}</p>
      <p className="text-secondary-foreground">NIP. {displayNip || '-'}</p>
      {email ? <p className="text-muted-foreground">{email}</p> : null}
    </div>
  )
}
