import { useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface PinDialogSubmitPayload {
  pin: string
  currentPin?: string
}

export interface PinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  currentPinLabel?: string
  pinLabel?: string
  confirmPinLabel?: string
  pinPlaceholder?: string
  confirmLabel?: string
  loadingLabel?: string
  requireCurrentPin?: boolean
  requireConfirm?: boolean
  minLength?: number
  maxLength?: number
  userSummary?: React.ReactNode
  onSubmit: (payload: PinDialogSubmitPayload) => boolean | void | Promise<boolean | void>
  onError?: (error: unknown) => void
}

export function PinDialog({
  open,
  onOpenChange,
  title,
  description,
  currentPinLabel = 'PIN lama',
  pinLabel = 'PIN TTE',
  confirmPinLabel = 'Konfirmasi PIN',
  pinPlaceholder = 'Masukkan PIN',
  confirmLabel = 'Simpan',
  loadingLabel,
  requireCurrentPin = false,
  requireConfirm = false,
  minLength = 4,
  maxLength = 32,
  userSummary,
  onSubmit,
  onError,
}: PinDialogProps) {
  const [currentPin, setCurrentPin] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const errorId = useId()

  useEffect(() => {
    if (open) {
      setCurrentPin('')
      setPin('')
      setPinConfirm('')
      setError(null)
      setLoading(false)
    }
  }, [open])

  const handleClose = () => {
    setCurrentPin('')
    setPin('')
    setPinConfirm('')
    setError(null)
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (requireCurrentPin && currentPin.length < minLength) {
      setError(`${currentPinLabel} minimal ${minLength} karakter.`)
      return
    }
    if (pin.length < minLength) {
      setError(`PIN minimal ${minLength} karakter.`)
      return
    }
    if (requireConfirm && pin !== pinConfirm) {
      setError('PIN dan konfirmasi PIN tidak sama.')
      return
    }

    setLoading(true)
    try {
      const result = await onSubmit({
        pin,
        currentPin: requireCurrentPin ? currentPin : undefined,
      })
      if (result === false) {
        setError('PIN salah. Silakan coba lagi.')
        return
      }
      handleClose()
    } catch (err) {
      onError?.(err)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        {description ? (
          <DialogDescription className="-mt-2 text-xs text-secondary-foreground">
            {description}
          </DialogDescription>
        ) : null}
        {userSummary}

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          {requireCurrentPin ? (
            <FormField label={currentPinLabel}>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                className="h-9 text-xs"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="PIN saat ini"
                maxLength={maxLength}
                aria-describedby={error ? errorId : undefined}
              />
            </FormField>
          ) : null}

          <FormField label={pinLabel}>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete={requireConfirm ? 'new-password' : 'off'}
              className="h-9 text-xs"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setError(null)
              }}
              placeholder={pinPlaceholder}
              maxLength={maxLength}
              aria-describedby={error ? errorId : undefined}
            />
          </FormField>

          {requireConfirm ? (
            <FormField label={confirmPinLabel}>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                className="h-9 text-xs"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                placeholder="Ulangi PIN"
                maxLength={maxLength}
                aria-describedby={error ? errorId : undefined}
              />
            </FormField>
          ) : null}

          {error ? (
            <p id={errorId} role="alert" className="text-xs text-red-600">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleClose}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs"
              disabled={loading}
            >
              {loading && loadingLabel ? loadingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
