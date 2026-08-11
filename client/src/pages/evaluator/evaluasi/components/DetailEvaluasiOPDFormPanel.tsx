import { useState, useEffect } from "react";
import { Activity, Check, CornerUpLeft, FileText, Building2, PanelsTopLeft, Unlock } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  CollapsedStripButton,
  CollapsibleSidePanel,
  CollapsibleSidePanelContent,
  CollapsibleSidePanelHeader,
  PanelTabStrip,
} from "@/components/ui/collapsible-side-panel";
import { InfoCard } from "@/components/ui/info-card";
import { RiwayatCardList } from "@/pages/evaluator/evaluasi/components/RiwayatCardList";
import { EvaluasiKeputusanSebelumnyaCard } from "@/pages/evaluator/evaluasi/components/EvaluasiKeputusanSebelumnyaCard";
import { EvaluasiSopTahapBanner } from "@/pages/evaluator/evaluasi/components/EvaluasiSopTahapBanner";
import { RiwayatNilaiEvaluasiPanel } from "@/pages/evaluator/evaluasi/components/RiwayatNilaiEvaluasiPanel";
import type { TahapPenilaianSop } from "@/lib/evaluasi/evaluasi-domain";
import { STATUS_HASIL_EVALUASI } from "@/types/dto/evaluasi.dto";
import { StatusHasilEvaluasiPicker } from "@/pages/evaluator/evaluasi/components/StatusHasilEvaluasiPicker";
import { SkorRatingPicker } from "@/pages/evaluator/evaluasi/components/SkorRatingPicker";
import type { RiwayatEvaluasiEntry } from "@/api/evaluasi";
import type { PengajuanTimelineNilaiEntry } from "@/types/dto/evaluasi.dto";
import { formatDateId } from "@/utils/format-date";
import type { StatusHasilEvaluasi } from "@/types/dto/evaluasi.dto";

export type DetailEvaluasiActiveTab = "sop" | "aktivitas" | "opd";

interface DetailEvaluasiPanelStateProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  activeFormTab: DetailEvaluasiActiveTab;
  onTabChange: (id: DetailEvaluasiActiveTab) => void;
}

interface DetailEvaluasiSopFormProps {
  effectiveSopId: string | null;
  /** true bila pengajuan sudah keluar dari tahap SEDANG_DIEVALUASI. */
  readOnly: boolean;
  tahapPenilaian: TahapPenilaianSop;
  versi?: number;
  detailUpdatedAt?: string | null;
  ditindaklanjutiPada?: string | null;
  nilaiTersimpan: { hasil: StatusHasilEvaluasi | null; catatan: string | null } | null;
  statusEvaluasi: StatusHasilEvaluasi | null;
  setStatusEvaluasi: (v: StatusHasilEvaluasi) => void;
  komentarEvaluasi: string;
  setKomentarEvaluasi: (v: string) => void;
  logNilaiEntries: PengajuanTimelineNilaiEntry[];
  isLogNilaiLoading?: boolean;
}

interface DetailEvaluasiOpdFormProps {
  opd: { id: string; nama: string; kode: string } | null;
  readOnly: boolean;
  nilaiOpdTersimpan: number | null;
  riwayatOpd: RiwayatEvaluasiEntry[];
  ratingOPD: number | null;
  setRatingOPD: (v: number | null) => void;
}

export interface DetailEvaluasiOPDFormPanelProps {
  /** false untuk pengajuan EVALUASI_REQUEST_OPD — tanpa tab Evaluasi OPD. */
  penilaianOpdDiizinkan?: boolean;
  panelState: DetailEvaluasiPanelStateProps;
  sopForm: DetailEvaluasiSopFormProps;
  opdForm: DetailEvaluasiOpdFormProps;
}

function labelHasilRiwayat(hasil: string | null | undefined): string {
  if (hasil === "SESUAI") return "Sesuai";
  if (hasil === "PERLU_PERBAIKAN") return "Perlu Perbaikan";
  return hasil ?? "—";
}

function labelSimpanHasilEvaluasi(hasil: StatusHasilEvaluasi | null): string {
  if (hasil === STATUS_HASIL_EVALUASI.SESUAI) return "Tandai Sesuai";
  if (hasil === STATUS_HASIL_EVALUASI.PERLU_PERBAIKAN) return "Ajukan Perbaikan";
  return "Simpan Hasil Evaluasi";
}

export function DetailEvaluasiOPDFormPanel({
  penilaianOpdDiizinkan = true,
  panelState,
  sopForm,
  opdForm,
}: DetailEvaluasiOPDFormPanelProps) {
  const [isLockedSopForm, setIsLockedSopForm] = useState(false);

  useEffect(() => {
    // Kunci otomatis saat pertama kali dibuka jika sudah pernah disimpan
    if (sopForm.effectiveSopId) {
      setIsLockedSopForm(sopForm.nilaiTersimpan?.hasil != null);
    }
  }, [sopForm.effectiveSopId]);

  const formTabs = penilaianOpdDiizinkan
    ? [
        {
          id: "sop" as const,
          label: "Evaluasi SOP",
          icon: <FileText className="w-3.5 h-3.5" />,
        },
        {
          id: "aktivitas" as const,
          label: "Aktivitas",
          icon: <Activity className="w-3.5 h-3.5" />,
        },
        {
          id: "opd" as const,
          label: "Evaluasi OPD",
          icon: <Building2 className="w-3.5 h-3.5" />,
        },
      ]
    : [
        {
          id: "sop" as const,
          label: "Evaluasi SOP",
          icon: <FileText className="w-3.5 h-3.5" />,
        },
        {
          id: "aktivitas" as const,
          label: "Aktivitas",
          icon: <Activity className="w-3.5 h-3.5" />,
        },
      ];
  const activeTabResolved =
    !penilaianOpdDiizinkan && panelState.activeFormTab === "opd"
      ? "sop"
      : panelState.activeFormTab;

  return (
    <CollapsibleSidePanel
      side="right"
      collapsed={panelState.collapsed}
      widthExpanded="w-full"
    >
      {panelState.collapsed ? (
        <CollapsedStripButton
          label="Form"
          icon={<PanelsTopLeft className="w-5 h-5" />}
          onClick={() => panelState.onCollapsedChange(false)}
        />
      ) : (
        <>
          <CollapsibleSidePanelHeader
            side="right"
            onCollapse={() => panelState.onCollapsedChange(true)}
          >
            <PanelTabStrip
              tabs={formTabs}
              activeTab={activeTabResolved}
              onTabChange={(id) => {
                panelState.onTabChange(id as DetailEvaluasiActiveTab);
              }}
            />
          </CollapsibleSidePanelHeader>
          <CollapsibleSidePanelContent className="px-2 pb-2 pt-1 sm:px-2">
            <div className="p-3 space-y-4">
        {activeTabResolved === "sop" && (
          <>
            {!sopForm.effectiveSopId ? (
              <p className="text-xs text-muted-foreground">
                Pilih SOP di daftar kiri untuk mengisi form evaluasi.
              </p>
            ) : sopForm.readOnly ? (
              <InfoCard variant="neutral" title="Penilaian ditutup">
                <div className="space-y-1.5 text-xs text-secondary-foreground">
                  <p>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="font-medium">
                      {labelHasilRiwayat(sopForm.nilaiTersimpan?.hasil)}
                    </span>
                  </p>
                  {sopForm.nilaiTersimpan?.catatan ? (
                    <p className="leading-snug whitespace-pre-wrap">
                      <span className="text-muted-foreground">Catatan: </span>
                      {sopForm.nilaiTersimpan.catatan}
                    </p>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Pengajuan sudah keluar dari tahap penilaian — tidak dapat
                  diubah.
                </p>
              </InfoCard>
            ) : (
              <>
                <EvaluasiSopTahapBanner
                  tahap={sopForm.tahapPenilaian}
                  versi={sopForm.versi}
                  detailUpdatedAt={sopForm.detailUpdatedAt}
                  ditindaklanjutiPada={sopForm.ditindaklanjutiPada}
                />
                {sopForm.tahapPenilaian === "tinjauan_ulang" &&
                sopForm.nilaiTersimpan?.hasil === "PERLU_PERBAIKAN" ? (
                  <EvaluasiKeputusanSebelumnyaCard
                    hasil="PERLU_PERBAIKAN"
                    catatan={sopForm.nilaiTersimpan.catatan}
                  />
                ) : null}
                <div className="space-y-3">
                  {sopForm.tahapPenilaian === "tinjauan_ulang" ? (
                    <p className="text-xs font-medium text-foreground">
                      Penilaian ulang
                    </p>
                  ) : null}
                  
                  {isLockedSopForm ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-surface-subtle border border-border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-secondary-foreground">Hasil Penilaian</span>
                          <span className="text-xs font-semibold text-foreground">{labelHasilRiwayat(sopForm.statusEvaluasi)}</span>
                        </div>
                        {sopForm.statusEvaluasi === STATUS_HASIL_EVALUASI.PERLU_PERBAIKAN && (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Catatan:</span>
                            <p className="text-xs text-foreground whitespace-pre-wrap">{sopForm.komentarEvaluasi || "-"}</p>
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5" onClick={() => setIsLockedSopForm(false)}>
                        <Unlock className="w-3.5 h-3.5" /> Ubah Penilaian
                      </Button>
                    </div>
                  ) : (
                    <>
                      <StatusHasilEvaluasiPicker
                        value={sopForm.statusEvaluasi}
                        onChange={(v) => {
                          sopForm.setStatusEvaluasi(v);
                          if (v === STATUS_HASIL_EVALUASI.SESUAI) {
                            sopForm.setKomentarEvaluasi("");
                          }
                        }}
                      />
                      {sopForm.statusEvaluasi ===
                        STATUS_HASIL_EVALUASI.PERLU_PERBAIKAN && (
                        <FormField label="Catatan" required>
                          <Textarea
                            className="text-xs min-h-[80px]"
                            placeholder="Catatan untuk penyusun"
                            value={sopForm.komentarEvaluasi}
                            onChange={(e) =>
                              sopForm.setKomentarEvaluasi(e.target.value)
                            }
                          />
                        </FormField>
                      )}
                      <div className="pt-2">
                        <Button 
                          size="sm" 
                          className="w-full text-xs h-8 gap-1.5" 
                          onClick={() => setIsLockedSopForm(true)} 
                          disabled={!sopForm.statusEvaluasi || (sopForm.statusEvaluasi === STATUS_HASIL_EVALUASI.PERLU_PERBAIKAN && !sopForm.komentarEvaluasi.trim())}
                        >
                          {sopForm.statusEvaluasi === STATUS_HASIL_EVALUASI.PERLU_PERBAIKAN ? (
                            <CornerUpLeft className="w-3.5 h-3.5" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          {labelSimpanHasilEvaluasi(sopForm.statusEvaluasi)}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {activeTabResolved === "aktivitas" && (
          <>
            {!sopForm.effectiveSopId ? (
              <p className="text-xs text-muted-foreground">
                Pilih SOP di daftar kiri untuk melihat aktivitas penilaian.
              </p>
            ) : (
              <RiwayatNilaiEvaluasiPanel
                entries={sopForm.logNilaiEntries}
                isLoading={sopForm.isLogNilaiLoading}
              />
            )}
          </>
        )}

        {activeTabResolved === "opd" && penilaianOpdDiizinkan && (
          <>
            {!opdForm.opd ? (
              <p className="text-xs text-muted-foreground">OPD tidak tersedia.</p>
            ) : (
              <>
                {opdForm.readOnly ? (
                  <InfoCard variant="neutral" title="Skor evaluasi OPD">
                    <p className="text-xs text-secondary-foreground">
                      {opdForm.nilaiOpdTersimpan != null ? (
                        <>
                          <span className="text-muted-foreground">Skor: </span>
                          <span className="font-semibold text-blue-700">
                            {opdForm.nilaiOpdTersimpan}/5
                          </span>
                        </>
                      ) : (
                        "Tidak ada skor OPD untuk pengajuan ini."
                      )}
                    </p>
                    <p className="mt-2 text-[10px] leading-relaxed text-secondary-foreground">
                      1 = Sangat rendah · 2 = Rendah · 3 = Sedang · 4 = Tinggi · 5 = Sangat tinggi
                    </p>
                  </InfoCard>
                ) : (
                  <SkorRatingPicker
                    value={opdForm.ratingOPD}
                    onChange={opdForm.setRatingOPD}
                  />
                )}

                <div className="border-t border-border pt-3">
                  <RiwayatCardList
                    title="Riwayat evaluasi OPD"
                    emptyMessage="Belum ada riwayat evaluasi OPD."
                    items={opdForm.riwayatOpd}
                    renderItem={(r) => (
                      <>
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          <span className="font-medium text-secondary-foreground">
                            {formatDateId(r.tanggal)}
                          </span>
                          <span className="text-muted-foreground">—</span>
                          <span className="text-secondary-foreground">
                            {r.evaluator}
                          </span>
                          {r.nilaiOPD != null && (
                            <span className="text-blue-600 font-medium">
                              Skor {r.nilaiOPD}/5
                            </span>
                          )}
                        </div>
                        {r.catatan && (
                          <p
                            className="text-secondary-foreground mt-1 leading-snug truncate"
                            title={r.catatan}
                          >
                            {r.catatan}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>
              </>
            )}
          </>
        )}
            </div>
          </CollapsibleSidePanelContent>
        </>
      )}
    </CollapsibleSidePanel>
  );
}
