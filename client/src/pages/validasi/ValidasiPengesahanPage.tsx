import { Link, useParams } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Download, Home, Loader2, Shield } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { usePublicSopDokumen } from "@/api/sop-public";
import { usePdfSigningStatus, useTtePengesahanPublic } from "@/api/tte";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoCard } from "@/components/ui/info-card";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { mapPenyusunWorkbenchToPreviewProps } from "@/lib/sop/detailSop.mappers";
import { scheduleSopDocumentPrint } from "@/lib/print/pengajuan-print";
import { ROLE_LABELS, ROUTES } from "@/utils/constants";
import type { PeranTTE, TTESignaturePayload } from "@/types/dto/tte.dto";
import { formatDateIdLong } from "@/utils/format-date";

function truncateHash(hex: string, head = 18, tail = 8): string {
  if (hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

function labelPeran(peran: PeranTTE): string {
  return ROLE_LABELS[peran] ?? peran;
}

function waitForPrintPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function ValidasiPengesahanPage() {
  const { dokumenTteId, userId } = useParams({ from: "/validasi/pengesahan/$dokumenTteId/$userId" });
  const query = useTtePengesahanPublic(dokumenTteId, userId);
  const pdfSigningStatus = usePdfSigningStatus();
  const [unduhLoading, setUnduhLoading] = useState(false);

  const sopDetailId = query.data?.dokumen.sopDetailId;
  const sopQuery = usePublicSopDokumen(sopDetailId);

  const sopPreviewProps = useMemo(() => {
    if (!sopQuery.data) {
      return null;
    }
    return mapPenyusunWorkbenchToPreviewProps({
      detail: sopQuery.data.detail,
      langkah: sopQuery.data.langkah,
      logEdit: [],
      diagramKonfigurasi: sopQuery.data.diagramKonfigurasi,
    });
  }, [sopQuery.data]);

  const tteSignaturePayload = useMemo<TTESignaturePayload | null>(() => {
    if (!query.isSuccess) {
      return null;
    }
    return {
      id: `${query.data.dokumenTteId}:${query.data.userId}`,
      dokumenTteId: query.data.dokumenTteId,
      userId: query.data.userId,
      nip: query.data.penandatangan.nip,
      namaLengkap: query.data.penandatangan.nama,
      jabatan: query.data.penandatangan.jabatan,
      signedAt: query.data.ditandatanganiPada,
    };
  }, [query.data, query.isSuccess]);

  const handleUnduhSop = useCallback(async () => {
    if (!sopPreviewProps) {
      return;
    }
    setUnduhLoading(true);
    try {
      await waitForPrintPaint();
      await scheduleSopDocumentPrint({
        ...sopPreviewProps,
        tteSignaturePayload,
      }, undefined, { signPdf: pdfSigningStatus.data?.enabled ?? false });
    } finally {
      setUnduhLoading(false);
    }
  }, [sopPreviewProps, tteSignaturePayload, pdfSigningStatus.data?.enabled]);

  const isSopDocument = Boolean(sopDetailId);
  const sopUnduhDisabled =
    unduhLoading || sopQuery.isLoading || sopQuery.isError || !sopPreviewProps;

  useDocumentTitle(
    "Verifikasi pengesahan",
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-border bg-surface p-2 shadow-surface">
            <Shield className="h-8 w-8 text-emerald-700" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Verifikasi pengesahan
            </h1>
            <p className="mt-1 text-sm text-secondary-foreground">
              Halaman publik untuk memastikan jejak tanda tangan elektronik (simulasi) sesuai data di
              server. Untuk PDF bertanda tangan PKCS#7, gunakan{" "}
              <Link to={ROUTES.VALIDASI.PDF} className="text-emerald-800 underline underline-offset-2">
                verifikasi PDF
              </Link>
              .
            </p>
          </div>
        </div>

        {query.isLoading ? (
          <Card className="border-border shadow-surface">
            <CardContent className="flex items-center justify-center gap-2 py-12 text-secondary-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span>Memuat data pengesahan…</span>
            </CardContent>
          </Card>
        ) : null}

        {query.isError ? (
          <InfoCard
            variant="warning"
            title="Data tidak ditemukan atau gagal dimuat"
            icon={<AlertCircle className="h-4 w-4" />}
          >
            <p className="text-foreground">
              Data pengesahan tidak dapat diverifikasi. Tautan mungkin tidak valid,
              sudah tidak berlaku, atau layanan sedang tidak tersedia.
            </p>
            <p className="mt-2 text-secondary-foreground">
              Pastikan tautan atau QR memuat pasangan ID dokumen TTE dan ID penandatangan yang valid.
            </p>
          </InfoCard>
        ) : null}

        {query.isSuccess ? (
          <>
            <InfoCard variant="success" title="Pengesahan terverifikasi" icon={<CheckCircle2 />}>
              <p className="text-foreground">
                Data di bawah ini bersumber dari server aplikasi. Hash dokumen dapat dipakai untuk
                transparansi verifikasi teknis.
              </p>
            </InfoCard>

            <Card className="border-border shadow-surface">
              <CardHeader className="border-b border-border pb-3">
                <h2 className="text-base font-semibold text-foreground">Penandatangan</h2>
              </CardHeader>
              <CardContent className="space-y-2 pt-4 text-sm">
                <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
                  <span className="text-muted-foreground">Nama</span>
                  <span className="font-medium text-foreground">{query.data.penandatangan.nama}</span>
                  <span className="text-muted-foreground">NIP</span>
                  <span className="text-foreground">{query.data.penandatangan.nip}</span>
                  <span className="text-muted-foreground">Jabatan</span>
                  <span className="text-foreground">
                    {query.data.penandatangan.jabatan.trim() !== ""
                      ? query.data.penandatangan.jabatan
                      : "—"}
                  </span>
                  <span className="text-muted-foreground">Peran</span>
                  <span className="text-foreground">{labelPeran(query.data.peran)}</span>
                  <span className="text-muted-foreground">Waktu pengesahan</span>
                  <span className="text-foreground">
                    {formatDateIdLong(query.data.ditandatanganiPada)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-surface">
              <CardHeader className="border-b border-border pb-3">
                <h2 className="text-base font-semibold text-foreground">Dokumen</h2>
              </CardHeader>
              <CardContent className="space-y-2 pt-4 text-sm">
                <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-x-3">
                  <span className="text-muted-foreground">Nomor</span>
                  <span className="font-medium text-foreground">{query.data.dokumen.nomorDokumen}</span>
                  <span className="text-muted-foreground">Judul</span>
                  <span className="text-foreground">{query.data.dokumen.judulDokumen}</span>
                  <span className="text-muted-foreground">Jenis</span>
                  <span className="text-foreground">{query.data.dokumen.jenisDokumen}</span>
                  <span className="text-muted-foreground">ID dokumen TTE</span>
                  <span className="font-mono text-xs text-foreground">{query.data.dokumen.dokumenTteId}</span>
                  <span className="text-muted-foreground">Hash dokumen</span>
                  <span
                    className="break-all font-mono text-xs text-foreground"
                    title={query.data.dokumen.hashDokumen}
                  >
                    {truncateHash(query.data.dokumen.hashDokumen)}
                  </span>
                </div>
                {isSopDocument ? (
                  <div className="space-y-2 border-t border-border pt-4">
                    {sopQuery.isError ? (
                      <p className="text-sm text-amber-800">
                        Dokumen SOP tidak dapat dimuat. Pastikan SOP masih berstatus Berlaku.
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={sopUnduhDisabled}
                      onClick={() => void handleUnduhSop()}
                    >
                      {unduhLoading || sopQuery.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Download className="h-4 w-4" aria-hidden />
                      )}
                      Unduh SOP
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Membuka dialog cetak browser — pilih &quot;Simpan sebagai PDF&quot; untuk mengunduh.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {query.data.qrVerificationUrl ? (
              <p className="text-center text-xs text-muted-foreground">
                Verifikasi dokumen terkait:{" "}
                <a
                  href={query.data.qrVerificationUrl}
                  className="text-emerald-800 underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  buka tautan verifikasi
                </a>
              </p>
            ) : null}
          </>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button variant="outline" asChild className="gap-2">
            <Link to={ROUTES.HOME}>
              <Home className="h-4 w-4" aria-hidden />
              Kembali ke beranda
            </Link>
          </Button>
        </div>


      </div>
    </div>
  );
}
