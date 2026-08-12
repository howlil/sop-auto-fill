import { displayStatusSop } from '../../../common/status/status-display';
import { StatusSOP } from '../../../generated/prisma';
import { encodeLogEditSopClientId } from '../collaboration/log-edit-session.helper';
import { mapDiagramConfigsToWorkbenchDto } from '../diagram/diagram-workbench.mapper';
import type { PenyusunWorkbenchDataDto } from './dto/penyusun-workbench-data.dto';
import type { SopDaftarRowDto } from './dto/sop-daftar-row.dto';
import type { SopDaftarDbRow, SopWorkbenchDbPayload } from './sop-catalog.repository';

export function toIso(date: Date): string {
  return date.toISOString();
}

export function mapWorkbenchPayload(row: SopWorkbenchDbPayload): PenyusunWorkbenchDataDto {
  const detailId = row.detailSopId;
  const statusDisplay = displayStatusSop(row.sop.status);

  const lampiran = {
    peringatan: [...row.lampiranPeringatan]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((item) => ({
        id: item.lampiranPeringatanId,
        teks: item.teks,
        createdAt: toIso(item.createdAt),
      })),
    kualifikasiPelaksanaan: [...row.lampiranKualifikasiPelaksanaan]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((item) => ({
        id: item.lampiranKualifikasiPelaksanaanId,
        teks: item.teks,
        createdAt: toIso(item.createdAt),
      })),
    peralatanPerlengkapan: [...row.lampiranPeralatanPerlengkapan]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((item) => ({
        id: item.lampiranPeralatanPerlengkapanId,
        teks: item.teks,
        createdAt: toIso(item.createdAt),
      })),
    pencatatanPendataan: [...row.lampiranPencatatanPendataan]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((item) => ({
        id: item.lampiranPencatatanPendataanId,
        teks: item.teks,
        createdAt: toIso(item.createdAt),
      })),
  };

  const dasarHukumSorted = [...row.dasarHukum].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const dasarHukum = dasarHukumSorted.map((item) => ({
    id: `${detailId}-${item.peraturanId}`,
    sopDetailId: detailId,
    peraturanId: item.peraturanId,
    judul: item.peraturan.tentang,
    nomor: String(item.peraturan.nomor),
    tahun: String(item.peraturan.tahun),
    createdAt: toIso(item.createdAt),
    updatedAt: toIso(item.updatedAt),
  }));

  const relasiSopKeluarSorted = [...row.relasiSopKeluar].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const relasiSopKeluar = relasiSopKeluarSorted.map((rel) => ({
    id: `${rel.detailSopId}-${rel.detailSopTerkaitId}`,
    sopDetailId: rel.detailSopId,
    sopTerkaitId: rel.detailSopTerkaitId,
    createdAt: toIso(rel.createdAt),
    updatedAt: toIso(rel.updatedAt),
    sopTerkait: {
      id: rel.sopTerkait.detailSopId,
      sopId: rel.sopTerkait.sopId,
      nomorSOP: rel.sopTerkait.nomorSOP,
      sop: { judul: rel.sopTerkait.sop.judul },
    },
  }));

  const relasiSopMasuk = row.relasiSopMasuk.map((rel) => ({
    id: `${rel.detailSopId}-${rel.detailSopTerkaitId}`,
    sopDetailId: rel.detailSopTerkaitId,
    sopTerkaitId: rel.detailSopId,
    createdAt: toIso(rel.createdAt),
    updatedAt: toIso(rel.updatedAt),
    sop: {
      id: rel.sop.detailSopId,
      sopId: rel.sop.sopId,
      nomorSOP: rel.sop.nomorSOP,
      sop: { judul: rel.sop.sop.judul },
    },
  }));

  const swimlanes = row.swimlanes.map((swimlane) => ({
    id: `${swimlane.detailSopId}-${swimlane.pelaksanaId}`,
    sopDetailId: swimlane.detailSopId,
    pelaksanaId: swimlane.pelaksanaId,
    urutan: swimlane.urutan,
    createdAt: toIso(swimlane.createdAt),
    updatedAt: toIso(swimlane.updatedAt),
    pelaksana: {
      id: swimlane.pelaksana.pelaksanaId,
      workspaceId: swimlane.pelaksana.workspaceId,
      namaPelaksana: swimlane.pelaksana.nama,
    },
  }));

  const detail: PenyusunWorkbenchDataDto['detail'] = {
    id: detailId,
    sopId: row.sopId,
    status: statusDisplay.value,
    statusLabel: statusDisplay.label,
    versi: row.versi,
    revisiDariDetailSopId: row.revisiDariDetailSopId,
    revisiDariVersi: row.revisiDari?.versi ?? null,
    nomorSOP: row.nomorSOP,
    tanggalPembuatan: toIso(row.tanggalPembuatan),
    tanggalRevisi: row.tanggalRevisi === null ? null : toIso(row.tanggalRevisi),
    tanggalEfektif: row.tanggalEfektif === null ? null : toIso(row.tanggalEfektif),
    logoInstansi: '',
    namaLembaga: row.namaLembaga,
    dibuatOlehId: row.dibuatOlehId,
    terakhirDieditOlehId: row.terakhirDieditOlehId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    sop: {
      id: row.sop.sopId,
      workspaceId: row.sop.workspaceId,
      judul: row.sop.judul,
      createdAt: toIso(row.sop.createdAt),
      updatedAt: toIso(row.sop.updatedAt),
    },
    dibuatOleh:
      row.dibuatOleh === null ? undefined : { id: row.dibuatOleh.userId, nama: row.dibuatOleh.name },
    terakhirDieditOleh:
      row.terakhirDieditOleh === null
        ? undefined
        : { id: row.terakhirDieditOleh.userId, nama: row.terakhirDieditOleh.name },
    lampiran,
    dasarHukum,
    relasiSopKeluar,
    relasiSopMasuk,
    swimlanes,
    dasarHukumPeraturanIds: dasarHukumSorted.map((item) => item.peraturanId),
    sopTerkaitDetailIds: relasiSopKeluarSorted.map((item) => item.detailSopTerkaitId),
  };

  const langkah: PenyusunWorkbenchDataDto['langkah'] = row.langkahSOP.map((step) => ({
    id: step.langkahSopId,
    sopDetailId: step.detailSopId,
    urutan: step.urutan,
    kegiatan: step.kegiatan,
    jenis: String(step.jenis),
    kelengkapan: step.kelengkapan,
    keluaran: step.keluaran,
    waktu: step.waktu,
    satuanWaktu: String(step.satuanWaktu),
    keterangan: step.keterangan,
    pelaksanaId: step.pelaksanaId,
    langkahSelanjutnyaYaId: step.langkahSelanjutnyaYaId,
    langkahSelanjutnyaTidakId: step.langkahSelanjutnyaTidakId,
    createdAt: toIso(step.createdAt),
    updatedAt: toIso(step.updatedAt),
    pelaksana: {
      id: step.pelaksana.pelaksanaId,
      namaPelaksana: step.pelaksana.nama,
    },
  }));

  const logEdit: PenyusunWorkbenchDataDto['logEdit'] = row.logEditSop.map((log) => ({
    id: encodeLogEditSopClientId(log.detailSopId, log.penggunaId, log.createdAt),
    sopDetailId: log.detailSopId,
    userId: log.penggunaId,
    bagian: log.bagian,
    keterangan: log.keterangan ?? null,
    meta: {
      fields: log.domainFields.map((field) => field.domainField).sort(),
      count: log.sesiChangeCount,
    },
    createdAt: toIso(log.createdAt),
    closedAt: log.closedAt instanceof Date ? toIso(log.closedAt) : null,
    user: {
      id: log.pengguna.userId,
      nama: log.pengguna.name,
      email: log.pengguna.email,
    },
  }));

  return {
    detail,
    langkah,
    logEdit,
    diagramKonfigurasi: mapDiagramConfigsToWorkbenchDto(row.konfigurasiDiagram),
  };
}

export function mapDaftarRow(row: SopDaftarDbRow): SopDaftarRowDto {
  const detail = row.detail;
  const statusDisplay = displayStatusSop(row.status);
  const updatedAt = detail?.updatedAt.toISOString() ?? null;
  return {
    id: row.sopId,
    workspaceId: row.workspaceId,
    detailSopId: detail?.detailSopId ?? null,
    judul: row.judul,
    nomorSop: detail?.nomorSOP ?? null,
    versi: detail?.versi ?? null,
    pembuat: detail?.pembuatNama ?? null,
    terakhirDiedit: {
      nama: detail?.editorNama ?? null,
      waktu: updatedAt,
    },
    status: statusDisplay.value,
    statusLabel: statusDisplay.label,
    peraturanId: detail?.peraturanId ?? null,
    terakhirDiperbarui: updatedAt,
    canBuatVersiBaru: row.status === StatusSOP.COMPLETED && detail !== undefined,
    canHapusSopDraft:
      row.status === StatusSOP.DRAFT && row.versionCount === 1 && (detail?.versi ?? 0) === 1,
    versionCount: row.versionCount,
  };
}
