import { TTESignatureBlock } from "@/components/tte/tte-signature-block";
import {
  BERITA_ACARA_KOP,
  BERITA_ACARA_LABEL_BIRO,
  BERITA_ACARA_LOKASI,
  BERITA_ACARA_PARAGRAF,
  BERITA_ACARA_PENUTUP,
  BERITA_ACARA_POIN_EVALUASI,
} from "@/lib/pengajuan/berita-acara-static-content";
import { formatTempatTanggal } from "@/utils/format-date";
import type { TTESignaturePayload } from "@/types/dto/tte.dto";
import { SOP_INSTITUTION_LOGO_URL } from "@/lib/sop/sop-institution-logo";

export interface BeritaAcaraTemplateProps {
  /** Nama OPD (e.g. "Dinas Koperasi dan UKM") */
  opd: string;
  /** Nomor Berita Acara */
  nomorBA?: string;
  /** Tanggal verifikasi (untuk "Padang, Bulan Tahun") */
  tanggalVerifikasi?: string | null;
  /** Nama pejabat PJ Evaluator Organisasi */
  namaBiro?: string;
  /** Nama PJ Penyusun OPD */
  namaPjPenyusun?: string;
  /** TTE PJ Evaluator Organisasi (jika sudah TTD) */
  tteSignaturePayloadPjEvaluator?: TTESignaturePayload;
  /** TTE PJ Penyusun OPD (jika sudah TTD) */
  tteSignaturePayloadPjPenyusun?: TTESignaturePayload;
  /** Nilai keseluruhan OPD dari penutupan pengajuan (opsional, tidak ditampilkan di template ringkas). */
  nilaiKeseluruhanOpd?: number;
  /** Ringkasan hasil evaluasi per SOP (opsional, tidak ditampilkan di template ringkas). */
  ringkasanHasilPerSop?: ReadonlyArray<{
    nomorSOP: string;
    judul: string;
    hasilEvaluasi?: string;
    ringkasanCatatanEvaluator?: string;
  }>;
  /** Tampilkan dalam mode cetak (margin, font) */
  forPrint?: boolean;
}

export function BeritaAcaraTemplate({
  opd,
  nomorBA,
  tanggalVerifikasi,
  namaBiro,
  namaPjPenyusun,
  tteSignaturePayloadPjEvaluator,
  tteSignaturePayloadPjPenyusun,
  forPrint = false,
}: BeritaAcaraTemplateProps) {
  const dateLine = formatTempatTanggal(
    tanggalVerifikasi ?? new Date().toISOString().slice(0, 10),
  );
  const wrapperClass = forPrint
    ? "mx-auto box-border flex min-h-[297mm] w-[210mm] max-w-[210mm] flex-col bg-surface text-black font-serif text-[11pt] px-[3cm] pt-[3cm] pb-[2.5cm]"
    : "mx-auto box-border flex min-h-[297mm] w-full max-w-[210mm] flex-col bg-surface text-foreground font-serif text-[11pt] px-[3cm] pt-[3cm] pb-[2.5cm] rounded-lg border border-border shadow-surface";
  const blockGap = forPrint ? "mb-4" : "mb-6";
  const dateGap = forPrint ? "mb-6" : "mb-12";

  return (
    <article className={wrapperClass}>
      <header className={`border-b-2 border-black pb-3 ${blockGap}`}>
        <div className="flex items-start gap-4">
          <img
            src={SOP_INSTITUTION_LOGO_URL}
            alt="Logo Provinsi Sumatera Barat"
            className="w-16 h-20 flex-shrink-0 object-contain"
          />
          <div className="flex-1 text-center">
            <p className="text-base font-bold uppercase leading-tight">
              {BERITA_ACARA_KOP.provinsi}
            </p>
            <p className="text-sm font-bold uppercase leading-tight mt-0.5">
              {BERITA_ACARA_KOP.lembaga}
            </p>
            <p className="text-[10pt] mt-1 text-secondary-foreground">{BERITA_ACARA_KOP.alamat}</p>
            <p className="text-[10pt] text-secondary-foreground">{BERITA_ACARA_KOP.website}</p>
          </div>
        </div>
      </header>

      <div className={`text-center ${blockGap}`}>
        <h1 className="text-base font-bold uppercase mb-2">Berita Acara</h1>
        <h2 className="text-sm font-bold uppercase leading-snug mb-1">
          Pelaksanaan Verifikasi dan Evaluasi Standar Operasional Prosedur (SOP)
          pada {opd} Provinsi Sumatera Barat
        </h2>
        {nomorBA && <p className="text-xs mt-1">Nomor: {nomorBA}</p>}
        <p className="text-xs mt-2">{BERITA_ACARA_LOKASI}</p>
      </div>

      <div className={`text-justify leading-relaxed space-y-3 ${blockGap}`}>
        {BERITA_ACARA_PARAGRAF.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
        <ol className="list-decimal list-inside pl-2 space-y-1 text-justify">
          {BERITA_ACARA_POIN_EVALUASI.map((item) => (
            <li key={item.slice(0, 20)}>{item}</li>
          ))}
        </ol>
        <p>{BERITA_ACARA_PENUTUP}</p>
      </div>

      <div className="mt-auto">
        <div className={`text-right ${dateGap}`}>
          <p className="text-sm">{dateLine}</p>
        </div>

        <div className="grid grid-cols-2 gap-8">
        <div className="border border-gray-800 p-4 text-center">
          <p className="text-xs font-bold uppercase mb-2">{BERITA_ACARA_LABEL_BIRO}</p>
          {tteSignaturePayloadPjEvaluator ? (
            <TTESignatureBlock
              payload={tteSignaturePayloadPjEvaluator}
              showRoleLabel={false}
              showNip={false}
              showCaption={false}
              showSignedDate={false}
              placeNameBelowQr
              qrSize={64}
            />
          ) : (
            <>
              <div className="h-16 mb-2" />
              <p className="text-sm font-bold">{namaBiro ?? "—"}</p>
            </>
          )}
        </div>
        <div className="border border-gray-800 p-4 text-center">
          <p className="text-xs font-bold uppercase mb-2">{opd}</p>
          {tteSignaturePayloadPjPenyusun ? (
            <TTESignatureBlock
              payload={tteSignaturePayloadPjPenyusun}
              showRoleLabel={false}
              showNip={false}
              showCaption={false}
              showSignedDate={false}
              placeNameBelowQr
              qrSize={64}
            />
          ) : (
            <>
              <div className="h-16 mb-2" />
              <p className="text-sm font-bold">{namaPjPenyusun ?? "—"}</p>
            </>
          )}
        </div>
        </div>
      </div>
    </article>
  );
}
