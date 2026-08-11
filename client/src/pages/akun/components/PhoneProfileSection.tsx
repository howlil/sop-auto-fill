import { useEffect, useMemo, useState } from "react";
import { Phone, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  formatIndonesianMobileNumberForInput,
  normalizeIndonesianMobileNumber,
} from "@/utils/indonesian-mobile-number";

interface PhoneProfileSectionProps {
  currentPhone?: string | null;
  isSaving: boolean;
  onSave: (normalizedPhone: string) => Promise<string>;
}

export function PhoneProfileSection({ currentPhone, isSaving, onSave }: PhoneProfileSectionProps) {
  const initialInput = useMemo(
    () => formatIndonesianMobileNumberForInput(currentPhone),
    [currentPhone],
  );
  const [phone, setPhone] = useState(initialInput);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setPhone(initialInput);
  }, [initialInput]);

  const normalizedCurrent = currentPhone ? normalizeIndonesianMobileNumber(currentPhone) : null;
  const normalizedInput = normalizeIndonesianMobileNumber(phone);
  const hasChanges = normalizedInput
    ? normalizedInput !== normalizedCurrent
    : phone.trim() !== initialInput;

  const reset = () => {
    setPhone(initialInput);
    setError(null);
    setSuccess(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const normalized = normalizeIndonesianMobileNumber(phone);
    if (!normalized) {
      setError(
        "Gunakan nomor seluler Indonesia dengan format 08... atau 628..., tanpa spasi atau tanda baca.",
      );
      return;
    }
    try {
      const savedPhone = await onSave(normalized);
      setPhone(formatIndonesianMobileNumberForInput(savedPhone));
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memperbarui nomor HP.");
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Nomor HP</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nomor ini dipakai untuk kontak dan pengiriman pengingat WhatsApp akun Anda.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3 px-5 py-5">
        <FormField label="Nomor HP aktif" htmlFor="profile-phone" required>
          <Input
            id="profile-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="Contoh: 081234567890"
            maxLength={15}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setError(null);
              setSuccess(false);
            }}
            disabled={isSaving}
            errorMessage={error ?? undefined}
          />
        </FormField>
        <p className="text-xs text-muted-foreground">
          Hanya angka; awali dengan <span className="font-medium">08</span> atau{" "}
          <span className="font-medium">628</span>.
        </p>
        {success && (
          <p
            role="status"
            className="rounded-lg border border-success bg-success-subtle px-3 py-2 text-xs text-success-foreground"
          >
            Nomor HP berhasil diperbarui.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          {hasChanges && (
            <Button type="button" size="sm" variant="outline" onClick={reset} disabled={isSaving}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Batal
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSaving || !hasChanges || !phone.trim()}>
            {isSaving ? "Menyimpan..." : "Simpan Nomor HP"}
          </Button>
        </div>
      </form>
    </section>
  );
}
