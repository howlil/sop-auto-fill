/**
 * TteSetupSection — Section TTE terintegrasi dengan wizard 2-langkah:
 *
 * Workflow:
 *   [Belum ada] → Step 1: Pilih metode sertifikat → isi form → selesai
 *   [Siap]      → Tampilkan status + tombol ubah PIN / ganti sertifikat
 */
import { useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Upload,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  FileKey2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { TteProfil } from "@/types/dto/tte.dto";
import { formatDateIdLong } from "@/utils/format-date";
import { useSetupTteGenerate, useSetupTteUpload, useUpdateTTEPin, useGenerateP12, useUploadP12, useRegisterTTE } from "@/api/tte";
import { TtePinDialog } from "./TtePinDialog";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type SetupStep = "choose-method" | "generate" | "upload-bsre";

interface TteSetupSectionProps {
  profile: TteProfil | null | undefined;
  isLoading: boolean;
  displayName: string;
  displayNip: string;
}

// ─────────────────────────────────────────────
// PIN input field (reusable)
// ─────────────────────────────────────────────
function PinInputField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  showToggle,
  show,
  onToggleShow,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showToggle?: boolean;
  show?: boolean;
  onToggleShow?: () => void;
}) {
  return (
    <FormField label={label}>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Masukkan PIN"}
          className="h-9 text-sm pr-10"
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
        />
        {showToggle && onToggleShow && (
          <button
            type="button"
            className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            onClick={onToggleShow}
            aria-label={show ? "Sembunyikan PIN" : "Tampilkan PIN"}
            aria-pressed={show}
          >
            {show ? (
              <EyeOff className="w-4 h-4" aria-hidden />
            ) : (
              <Eye className="w-4 h-4" aria-hidden />
            )}
          </button>
        )}
      </div>
    </FormField>
  );
}

// ─────────────────────────────────────────────
// Step progress bar
// ─────────────────────────────────────────────
function SetupProgressBar({ step }: { step: SetupStep }) {
  const isForm = step === "generate" || step === "upload-bsre";
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex items-center gap-1.5">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${isForm ? "bg-blue-600 text-white" : "bg-blue-600 text-white"}`}>
          {isForm ? <CheckCircle2 className="w-3.5 h-3.5" /> : "1"}
        </div>
        <span className="text-xs font-medium text-secondary-foreground">Sertifikat</span>
      </div>
      <div className="flex-1 h-px bg-border mx-1" />
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-muted text-muted-foreground">
          2
        </div>
        <span className="text-xs text-muted-foreground">PIN TTE</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Setup Wizard
// ─────────────────────────────────────────────
function SetupWizard({
  displayName,
  displayNip,
}: {
  displayName: string;
  displayNip: string;
}) {
  const [step, setStep] = useState<SetupStep>("choose-method");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [p12Passphrase, setP12Passphrase] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pinError, setPinError] = useState("");

  const setupGenerate = useSetupTteGenerate();
  const setupUpload = useSetupTteUpload();
  const isPending = setupGenerate.isPending || setupUpload.isPending;

  const validatePin = () => {
    if (pin.length < 4) { setPinError("PIN minimal 4 karakter"); return false; }
    if (pin !== pinConfirm) { setPinError("Konfirmasi PIN tidak cocok"); return false; }
    setPinError("");
    return true;
  };

  const resetPinFields = () => {
    setPin(""); setPinConfirm(""); setPinError(""); setShowPin(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePin()) return;
    try {
      await setupGenerate.mutateAsync({ pin });
    } catch { /* toast already handled */ }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePin()) return;
    if (!file) return;
    try {
      await setupUpload.mutateAsync({ payload: { pin, p12Passphrase }, file });
    } catch { /* toast already handled */ }
  };

  // Step 1: pilih metode
  if (step === "choose-method") {
    return (
      <div className="space-y-5">
        <SetupProgressBar step={step} />
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Pilih jenis sertifikat</p>
          <p className="text-xs text-muted-foreground">
            Sertifikat digunakan untuk menandatangani dokumen PDF secara digital. Pilih sesuai kebutuhan.
          </p>
        </div>
        <div className="space-y-2">
          {/* Opsi 1: Generate otomatis */}
          <button
            type="button"
            onClick={() => { setStep("generate"); resetPinFields(); }}
            className="w-full text-left rounded-xl border-2 border-blue-100 bg-blue-50/60 hover:border-blue-300 hover:bg-blue-50 transition-all p-4 group"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-700 transition-colors">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Buat Otomatis</p>
                  <span className="inline-flex min-h-6 items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Rekomendasi</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Sistem membuat sertifikat personal untuk Anda. Cocok untuk penggunaan internal.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-blue-400 transition-colors" />
            </div>
          </button>

          {/* Opsi 2: Upload BSrE */}
          <button
            type="button"
            onClick={() => { setStep("upload-bsre"); resetPinFields(); }}
            className="group w-full rounded-xl border-2 border-border-strong bg-surface p-4 text-left transition-all hover:bg-surface-subtle/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-8 h-8 rounded-lg bg-secondary-foreground flex items-center justify-center shrink-0 group-hover:bg-foreground transition-colors">
                <Upload className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Unggah dari BSrE</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Gunakan file P12 resmi dari Badan Siber dan Sandi Negara (BSrE/BSSN).
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-muted-foreground transition-colors" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Step form: generate + PIN
  if (step === "generate") {
    return (
      <form onSubmit={handleGenerate} className="space-y-5">
        <SetupProgressBar step={step} />

        {/* Identitas */}
        <div className="rounded-lg bg-surface-subtle border border-border px-3.5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-blue-700">
              {(displayName || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName || "—"}</p>
            <p className="text-xs text-muted-foreground font-mono">NIP. {displayNip || "—"}</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-secondary-foreground flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-blue-500" />
            Buat PIN TTE
          </p>
          <PinInputField
            label="PIN baru"
            value={pin}
            onChange={(v) => { setPin(v); setPinError(""); }}
            disabled={isPending}
            placeholder="Min. 4 karakter"
            showToggle
            show={showPin}
            onToggleShow={() => setShowPin(!showPin)}
          />
          <PinInputField
            label="Ulangi PIN"
            value={pinConfirm}
            onChange={(v) => { setPinConfirm(v); setPinError(""); }}
            disabled={isPending}
            placeholder="Konfirmasi PIN"
            show={showPin}
          />
          {pinError && (
            <p role="alert" className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {pinError}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" />
            PIN digunakan setiap kali menandatangani dokumen. Jangan bagikan ke siapapun.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-muted-foreground"
            onClick={() => setStep("choose-method")}
            disabled={isPending}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-9 text-sm flex-1 font-medium"
            disabled={isPending || !pin || !pinConfirm}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Memproses...
              </span>
            ) : "Buat Sertifikat & Aktifkan"}
          </Button>
        </div>
      </form>
    );
  }

  // Step form: upload P12 BSrE + PIN
  if (step === "upload-bsre") {
    return (
      <form onSubmit={handleUpload} className="space-y-4">
        <SetupProgressBar step={step} />

        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3.5 py-3 text-xs text-amber-800 leading-relaxed">
          Passphrase asli file P12 Anda tidak disimpan di server — hanya disimpan dalam bentuk terenkripsi menggunakan PIN TTE yang Anda buat.
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-secondary-foreground flex items-center gap-1.5">
            <FileKey2 className="w-3.5 h-3.5 text-muted-foreground" />
            File Sertifikat
          </p>
          <FormField label="File P12 / PFX">
            <label
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed px-3 py-3 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
                file ? "border-primary bg-primary-subtle/50" : "border-border-strong hover:border-primary hover:bg-surface-subtle/60"
              } ${isPending ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Upload className={`w-4 h-4 shrink-0 ${file ? "text-blue-500" : "text-muted-foreground"}`} />
              <span className={`text-xs truncate ${file ? "text-blue-700 font-medium" : "text-muted-foreground"}`}>
                {file ? file.name : "Klik untuk pilih file .p12 atau .pfx"}
              </span>
              <input
                type="file"
                accept=".p12,.pfx"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={isPending}
              />
            </label>
          </FormField>
          <FormField label="Passphrase P12">
            <Input
              type="password"
              value={p12Passphrase}
              onChange={(e) => setP12Passphrase(e.target.value)}
              placeholder="Passphrase dari BSrE"
              className="h-9 text-sm"
              required
              disabled={isPending}
              autoComplete="off"
            />
          </FormField>
        </div>

        <div className="space-y-3 pt-1 border-t border-border">
          <p className="text-xs font-medium text-secondary-foreground flex items-center gap-1.5 pt-1">
            <KeyRound className="w-3.5 h-3.5 text-blue-500" />
            Buat PIN TTE
          </p>
          <PinInputField
            label="PIN baru"
            value={pin}
            onChange={(v) => { setPin(v); setPinError(""); }}
            disabled={isPending}
            placeholder="Min. 4 karakter"
            showToggle
            show={showPin}
            onToggleShow={() => setShowPin(!showPin)}
          />
          <PinInputField
            label="Ulangi PIN"
            value={pinConfirm}
            onChange={(v) => { setPinConfirm(v); setPinError(""); }}
            disabled={isPending}
            placeholder="Konfirmasi PIN"
            show={showPin}
          />
          {pinError && (
            <p role="alert" className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {pinError}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-muted-foreground"
            onClick={() => setStep("choose-method")}
            disabled={isPending}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-9 text-sm flex-1 font-medium"
            disabled={isPending || !pin || !pinConfirm || !file || !p12Passphrase}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Mengunggah...
              </span>
            ) : "Unggah & Aktifkan"}
          </Button>
        </div>
      </form>
    );
  }

  return null;
}

// ─────────────────────────────────────────────
// Dialog: Ganti Sertifikat (sudah punya PIN)
// ─────────────────────────────────────────────
function GantiSertifikatDialog({
  open,
  onOpenChange,
  hasP12,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasP12?: boolean;
}) {
  const [pin, setPin] = useState("");
  const [p12Passphrase, setP12Passphrase] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"generate" | "upload">("generate");

  const generateP12 = useGenerateP12();
  const uploadP12 = useUploadP12();
  const isPending = generateP12.isPending || uploadP12.isPending;

  const handleClose = () => {
    if (isPending) return;
    onOpenChange(false);
    setPin(""); setP12Passphrase(""); setFile(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await generateP12.mutateAsync({ pin }); handleClose(); } catch { /* handled */ }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try { await uploadP12.mutateAsync({ payload: { pin, p12Passphrase }, file }); handleClose(); } catch { /* handled */ }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileKey2 className="w-4 h-4 text-secondary-foreground" />
            {hasP12 ? "Ganti Sertifikat TTE" : "Atur Sertifikat TTE"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {hasP12
              ? "Masukkan PIN TTE aktif untuk mengonfirmasi penggantian sertifikat."
              : "Anda sudah memiliki PIN TTE. Atur sertifikat dengan mengonfirmasi PIN aktif Anda."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-surface-muted rounded-lg">
          {(["generate", "upload"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-all ${
                activeTab === t ? "bg-surface shadow-surface text-foreground" : "text-muted-foreground hover:text-secondary-foreground"
              }`}
            >
              {t === "generate" ? <Sparkles className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
              {t === "generate" ? "Buat Otomatis" : "Unggah BSrE"}
            </button>
          ))}
        </div>

        {activeTab === "generate" ? (
          <form onSubmit={handleGenerate} className="space-y-3">
            <FormField label="PIN TTE saat ini">
              <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Masukkan PIN" className="h-9 text-sm" required disabled={isPending} autoComplete="off" />
            </FormField>
            <Button type="submit" size="sm" className="w-full h-9 text-sm font-medium" disabled={isPending || !pin}>
              {generateP12.isPending ? (
                <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Memproses...</span>
              ) : "Buat Sertifikat Baru"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleUpload} className="space-y-3">
            <FormField label="PIN TTE saat ini">
              <Input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Masukkan PIN" className="h-9 text-sm" required disabled={isPending} autoComplete="off" />
            </FormField>
            <FormField label="File P12">
              <label className={`flex w-full cursor-pointer items-center gap-2 rounded-control border-2 border-dashed px-3 py-2.5 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${file ? "border-primary bg-primary-subtle/50" : "border-border-strong hover:border-primary"} ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className={`w-3.5 h-3.5 shrink-0 ${file ? "text-blue-500" : "text-muted-foreground"}`} />
                <span className={`text-xs truncate ${file ? "text-blue-700 font-medium" : "text-muted-foreground"}`}>
                  {file ? file.name : "Pilih file .p12"}
                </span>
                <input type="file" accept=".p12,.pfx" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={isPending} />
              </label>
            </FormField>
            <FormField label="Passphrase P12">
              <Input type="password" value={p12Passphrase} onChange={(e) => setP12Passphrase(e.target.value)} placeholder="Passphrase dari BSrE" className="h-9 text-sm" required disabled={isPending} autoComplete="off" />
            </FormField>
            <Button type="submit" size="sm" className="w-full h-9 text-sm font-medium" disabled={isPending || !pin || !file || !p12Passphrase}>
              {uploadP12.isPending ? (
                <span className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Mengunggah...</span>
              ) : "Unggah Sertifikat"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Status: TTE sudah aktif
// ─────────────────────────────────────────────
function TteActiveState({
  profile,
  displayName,
  displayNip,
  onChangePinClick,
  onChangeSertifikatClick,
}: {
  profile: TteProfil;
  displayName: string;
  displayNip: string;
  onChangePinClick: () => void;
  onChangeSertifikatClick: () => void;
}) {
  const hasP12 = Boolean(profile.hasP12);

  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
        hasP12 ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"
      }`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          hasP12 ? "bg-green-100" : "bg-amber-100"
        }`}>
          <ShieldCheck className={`w-5 h-5 ${hasP12 ? "text-green-600" : "text-amber-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${hasP12 ? "text-green-900" : "text-amber-900"}`}>
            {hasP12 ? "TTE Aktif" : "Sertifikat Belum Diatur"}
          </p>
          <p className={`text-xs ${hasP12 ? "text-green-600" : "text-amber-600"}`}>
            Diperbarui {formatDateIdLong(profile.updatedAt)}
          </p>
        </div>
        <span className={`inline-flex min-h-6 shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
          hasP12 ? "bg-green-200/70 text-green-800" : "bg-amber-200/70 text-amber-800"
        }`}>
          {hasP12 ? "Siap" : "Perlu Tindakan"}
        </span>
      </div>

      {/* Credential items */}
      <div className="space-y-2">
        <CredentialRow
          icon={<FileKey2 className="w-4 h-4 text-blue-500" />}
          label="Sertifikat P12"
          value={hasP12 ? "Tersedia" : "Belum diatur"}
          status={hasP12 ? "ok" : "warn"}
        />
        <CredentialRow
          icon={<KeyRound className="w-4 h-4 text-blue-500" />}
          label="PIN TTE"
          value="Aktif"
          status="ok"
        />
      </div>

      {/* Identitas singkat */}
      <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-surface-subtle border border-border">
        <div className="w-7 h-7 rounded-full bg-border flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-secondary-foreground">
            {(profile.user?.nama ?? displayName).charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{profile.user?.nama ?? displayName}</p>
          <p className="text-[11px] text-muted-foreground font-mono">NIP. {profile.user?.nip ?? displayNip}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 font-medium"
          onClick={onChangePinClick}
        >
          <KeyRound className="w-3.5 h-3.5" />
          Ubah PIN
        </Button>
        <Button
          variant={hasP12 ? "outline" : "default"}
          size="sm"
          className="h-8 text-xs gap-1.5 font-medium"
          onClick={onChangeSertifikatClick}
        >
          {hasP12 ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {hasP12 ? "Ganti Sertifikat" : "Atur Sertifikat"}
        </Button>
      </div>
    </div>
  );
}

function CredentialRow({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: "ok" | "warn";
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-border bg-surface">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-xs text-secondary-foreground flex-1">{label}</span>
      <span className={`inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
        status === "ok"
          ? "bg-green-100 text-green-800"
          : "bg-amber-100 text-amber-900"
      }`}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Export
// ─────────────────────────────────────────────
export function TteSetupSection({ profile, isLoading, displayName, displayNip }: TteSetupSectionProps) {
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [sertifikatDialogOpen, setSertifikatDialogOpen] = useState(false);

  const registerTTE = useRegisterTTE();
  const updateTTEPin = useUpdateTTEPin();

  const isReady = Boolean(profile);

  return (
    <section className="bg-surface rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Tanda Tangan Elektronik</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {profile?.hasP12
                ? "Akun TTE aktif dan siap digunakan untuk menandatangani dokumen."
                : profile
                  ? "Sertifikat P12 belum diatur. Buat sertifikat untuk mulai menandatangani."
                  : "Siapkan sertifikat dan PIN untuk mulai menandatangani."}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Memuat...</span>
          </div>
        ) : isReady && profile ? (
          <TteActiveState
            profile={profile}
            displayName={displayName}
            displayNip={displayNip}
            onChangePinClick={() => setPinDialogOpen(true)}
            onChangeSertifikatClick={() => setSertifikatDialogOpen(true)}
          />
        ) : (
          <SetupWizard displayName={displayName} displayNip={displayNip} />
        )}
      </div>

      {/* Dialogs */}
      {profile && (
        <>
          <TtePinDialog
            open={pinDialogOpen}
            onOpenChange={setPinDialogOpen}
            mode="update"
            namaRingkas={displayName}
            nipRingkas={displayNip}
            profile={profile}
            onRegisterTTE={(payload) => registerTTE.mutateAsync(payload)}
            onUpdateTTEPin={(payload) => updateTTEPin.mutateAsync(payload)}
          />
          <GantiSertifikatDialog
            open={sertifikatDialogOpen}
            onOpenChange={setSertifikatDialogOpen}
            hasP12={Boolean(profile.hasP12)}
          />
        </>
      )}
    </section>
  );
}
