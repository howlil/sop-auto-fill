import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { InfoCard } from "@/components/ui/info-card";
import { useGenerateP12, useUploadP12 } from "@/api/tte";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface TteP12DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasP12: boolean;
}

export function TteP12Dialog({ open, onOpenChange, hasP12 }: TteP12DialogProps) {
  const [pin, setPin] = useState("");
  const [p12Passphrase, setP12Passphrase] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const generateP12 = useGenerateP12();
  const uploadP12 = useUploadP12();

  const isPending = generateP12.isPending || uploadP12.isPending;

  const handleClose = () => {
    if (isPending) return;
    onOpenChange(false);
    setPin("");
    setP12Passphrase("");
    setFile(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await generateP12.mutateAsync({ pin });
      handleClose();
    } catch {
      // toast already handled
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      await uploadP12.mutateAsync({ payload: { pin, p12Passphrase }, file });
      handleClose();
    } catch {
      // toast already handled
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Atur Sertifikat TTE (P12)</DialogTitle>
          <DialogDescription>
            {hasP12
              ? "Sertifikat P12 Anda sudah diatur. Mengatur ulang akan menimpa sertifikat sebelumnya."
              : "Sertifikat P12 diperlukan untuk menandatangani PDF. Pilih salah satu metode di bawah ini."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Otomatis</TabsTrigger>
            <TabsTrigger value="upload">Unggah (BSrE)</TabsTrigger>
          </TabsList>
          <TabsContent value="generate" className="mt-4">
            <form onSubmit={handleGenerate} className="space-y-4">
              <InfoCard variant="neutral">
                Sistem akan membuatkan sertifikat personal untuk Anda. Cocok untuk pengujian atau penggunaan internal.
              </InfoCard>
              <FormField label="PIN TTE Anda saat ini">
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan 4-6 digit PIN TTE"
                  required
                  disabled={isPending}
                />
              </FormField>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isPending || !pin}>
                  {generateP12.isPending ? "Memproses..." : "Buat Sertifikat"}
                </Button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="upload" className="mt-4">
            <form onSubmit={handleUpload} className="space-y-4">
              <InfoCard variant="warning">
                Gunakan file P12 resmi dari BSrE. Kami tidak menyimpan passphrase asli Anda, melainkan mengenkripsinya dengan PIN TTE Anda.
              </InfoCard>
              <FormField label="PIN TTE Anda saat ini">
                <Input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Untuk enkripsi sertifikat di database"
                  required
                  disabled={isPending}
                />
              </FormField>
              <FormField label="File P12">
                <Input
                  type="file"
                  accept=".p12"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                  disabled={isPending}
                />
              </FormField>
              <FormField label="Passphrase P12 Asli">
                <Input
                  type="password"
                  value={p12Passphrase}
                  onChange={(e) => setP12Passphrase(e.target.value)}
                  placeholder="Passphrase dari BSrE"
                  required
                  disabled={isPending}
                />
              </FormField>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isPending || !pin || !file || !p12Passphrase}>
                  {uploadP12.isPending ? "Mengunggah..." : "Unggah Sertifikat"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
