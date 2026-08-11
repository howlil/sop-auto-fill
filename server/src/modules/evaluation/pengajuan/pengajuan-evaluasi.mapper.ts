import {
  displayHasilEvaluasi,
  displayStatusPengajuan,
  displayStatusSop,
  displayStatusTindakLanjut,
} from '../../../common/status/status-display';
import { PeranPengguna, StatusPengajuanEvaluasi } from '../../../generated/prisma';
import { encodeLogNilaiEvaluasiClientId } from '../nilai/log-nilai-evaluasi-client-id';
import { buildNilaiEvaluasiClientId } from '../nilai/nilai-evaluasi-client-id';
import type { PengajuanEvaluasiDetailRow } from './pengajuan-evaluasi.repository';

const STATUS_PENGAJUAN_SUDAH_DIVERIFIKASI = new Set<StatusPengajuanEvaluasi>([
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
  StatusPengajuanEvaluasi.SELESAI,
]);

/** Muatan data selaras kebutuhan klien (`PengajuanEvaluasi` di `evaluasi.dto.ts`). */
export type PengajuanEvaluasiApiPayload = Record<string, unknown>;

export function shouldOmitOpdFieldsForViewer(viewerPeran?: string): boolean {
  return viewerPeran === PeranPengguna.PJ_PENYUSUN;
}

export function mapPengajuanEvaluasiRow(
  row: PengajuanEvaluasiDetailRow,
  viewerPeran?: string,
): PengajuanEvaluasiApiPayload {
  const dokBa = row.dokumenTte[0];
  const nomorBA =
    row.nomorBA ?? (dokBa !== undefined && dokBa !== null ? dokBa.nomorDokumen : undefined);
  const sopList = row.nilaiEvaluasi.map((n) => {
    const statusDisplay = displayStatusSop(n.detailSop.status);
    const hasilDisplay = displayHasilEvaluasi(n.hasil);
    return {
      id: buildNilaiEvaluasiClientId(row.pengajuanEvaluasiId, n.detailSopId),
      sopDetailId: n.detailSopId,
      judul: n.detailSop.sop.judul,
      nomor: n.detailSop.nomorSOP,
      nama: n.detailSop.sop.judul,
      nomorSOP: n.detailSop.nomorSOP,
      status: statusDisplay.value,
      statusLabel: statusDisplay.label,
      hasil: hasilDisplay.value,
      hasilLabel: hasilDisplay.label,
    };
  });
  const nilaiEvaluasi = row.nilaiEvaluasi.map((n) => {
    const tindakDisplay = displayStatusTindakLanjut(n.statusTindakLanjut);
    return {
      id: buildNilaiEvaluasiClientId(row.pengajuanEvaluasiId, n.detailSopId),
      pengajuanEvaluasiId: row.pengajuanEvaluasiId,
      sopDetailId: n.detailSopId,
      hasil: displayHasilEvaluasi(n.hasil).value,
      catatan: n.catatan ?? undefined,
      statusTindakLanjut: tindakDisplay?.value,
      statusTindakLanjutLabel: tindakDisplay?.label,
      ditindaklanjutiPada: n.ditindaklanjutiPada?.toISOString(),
      version: n.version,
      dinilaiOlehId: n.dinilaiOlehId ?? undefined,
      dinilaiOleh:
        n.dinilaiOleh !== null && n.dinilaiOleh !== undefined
          ? { id: n.dinilaiOleh.penggunaId, nama: n.dinilaiOleh.nama }
          : undefined,
      sopDetail: { id: n.detailSopId },
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  });
  const riwayatEvaluasi = row.logNilaiEvaluasi.map((log) => ({
    id: encodeLogNilaiEvaluasiClientId(
      log.pengajuanEvaluasiId,
      log.detailSopId,
      log.penggunaId,
      log.createdAt,
    ),
    sopDetailId: log.detailSopId,
    evaluatorId: log.penggunaId,
    evaluatorNama: log.pengguna.nama,
    hasilSebelum:
      log.hasilSebelum === null || log.hasilSebelum === undefined
        ? undefined
        : displayHasilEvaluasi(log.hasilSebelum).value,
    hasilSesudah:
      log.hasilSesudah === null || log.hasilSesudah === undefined
        ? undefined
        : displayHasilEvaluasi(log.hasilSesudah).value,
    catatanSebelum: log.catatanSebelum ?? undefined,
    catatanSesudah: log.catatanSesudah ?? undefined,
    createdAt: log.createdAt.toISOString(),
  }));
  const tanggalVerifikasi = STATUS_PENGAJUAN_SUDAH_DIVERIFIKASI.has(row.status)
    ? row.updatedAt.toISOString()
    : undefined;
  const statusDisplay = displayStatusPengajuan(row.status);
  const omitOpdFields = shouldOmitOpdFieldsForViewer(viewerPeran);
  const payload: PengajuanEvaluasiApiPayload = {
    id: row.pengajuanEvaluasiId,
    jenis: String(row.jenis),
    status: statusDisplay.value,
    statusLabel: statusDisplay.label,
    nomorBA,
    tanggalPermintaan: row.tanggalPermintaan?.toISOString(),
    tanggalEvaluasi: row.tanggalEvaluasi?.toISOString(),
    tanggalVerifikasi,
    namaBiro: undefined,
    diverifikasiOlehUserId: row.diverifikasiOlehUserId ?? undefined,
    namaPjEvaluator: row.diverifikasiOlehUser?.nama ?? row.diselesaikanOleh?.nama ?? undefined,
    ditandatanganiOlehPjPenyusunUserId: row.ditandatanganiOlehPjPenyusunUserId ?? undefined,
    namaPjPenyusun: row.ditandatanganiOlehPjPenyusunUser?.nama ?? undefined,
    tanggalTTDBaPjPenyusun: row.tanggalTTDBaPjPenyusun?.toISOString(),
    diselesaikanOlehId: row.diselesaikanOlehId ?? undefined,
    diselesaikanOleh:
      row.diselesaikanOleh !== null && row.diselesaikanOleh !== undefined
        ? { id: row.diselesaikanOleh.penggunaId, nama: row.diselesaikanOleh.nama }
        : undefined,
    timEvaluasi: row.diselesaikanOleh?.nama ?? '',
    tanggalDiselesaikan: row.tanggalDiselesaikan?.toISOString(),
    alasanPenolakan: row.alasanPenolakan ?? undefined,
    tanggalDitolak: row.tanggalDitolak?.toISOString(),
    ditolakOlehId: row.ditolakOlehId ?? undefined,
    ditolakOleh:
      row.ditolakOleh !== null && row.ditolakOleh !== undefined
        ? { id: row.ditolakOleh.penggunaId, nama: row.ditolakOleh.nama }
        : undefined,
    sopList,
    nilaiEvaluasi,
    riwayatEvaluasi,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (!omitOpdFields) {
    payload.opdId = row.opdId;
    payload.opdNama = row.opd.nama;
    payload.nilaiOPD = row.nilaiOPD ?? undefined;
    payload.opd = { id: row.opd.opdId, nama: row.opd.nama };
  }
  return payload;
}
