import { displayStatusSop } from '../../../common/status/status-display';
import {
  hasRevisiInFlight,
  TERMINAL_DETAIL_STATUSES,
} from '../../../common/status/sop-editable.util';
import { StatusSOP } from '../../../generated/prisma';
import { buildNilaiEvaluasiClientId } from '../../evaluation/nilai/nilai-evaluasi-client-id';
import { encodeLogEditSopClientId } from '../collaboration/log-edit-session.helper';
import type { PenyusunWorkbenchDataDto } from './dto/penyusun-workbench-data.dto';
import type { SopDaftarRowDto } from './dto/sop-daftar-row.dto';
import type { SopDaftarVersiSliceDto } from './dto/sop-daftar-versi-slice.dto';
import type { SopDaftarDbRow, SopWorkbenchDbPayload } from './sop-catalog.repository';
import { mapDiagramConfigsToWorkbenchDto } from '../diagram/diagram-workbench.mapper';

import type { BeritaAcaraTteSignaturePayloadDto } from '../../evaluation/pengajuan-detail/dto/berita-acara-evaluasi-view.dto';
import { PeranPengguna } from '../../../generated/prisma';

export function toIso(d: Date): string {
  return d.toISOString();
}

export function mapWorkbenchPayload(row: SopWorkbenchDbPayload): PenyusunWorkbenchDataDto {
  const detailId = row.detailSopId;
  const sopHeader = {
    id: row.sop.sopId,
    opdId: row.sop.opdId,
    judul: row.sop.judul,
    createdAt: toIso(row.sop.createdAt),
    updatedAt: toIso(row.sop.updatedAt),
  };
  const peringatanSorted = [...row.lampiranPeringatan].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const lampiran = {
    peringatan: peringatanSorted.map((l) => ({
      id: l.lampiranPeringatanId,
      teks: l.teks,
      createdAt: toIso(l.createdAt),
    })),
    kualifikasiPelaksanaan: [...row.lampiranKualifikasiPelaksanaan]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((l) => ({
        id: l.lampiranKualifikasiPelaksanaanId,
        teks: l.teks,
        createdAt: toIso(l.createdAt),
      })),
    peralatanPerlengkapan: [...row.lampiranPeralatanPerlengkapan]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((l) => ({
        id: l.lampiranPeralatanPerlengkapanId,
        teks: l.teks,
        createdAt: toIso(l.createdAt),
      })),
    pencatatanPendataan: [...row.lampiranPencatatanPendataan]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((l) => ({
        id: l.lampiranPencatatanPendataanId,
        teks: l.teks,
        createdAt: toIso(l.createdAt),
      })),
  };
  const dasarHukumSorted = [...row.dasarHukum].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const dasarHukum = dasarHukumSorted.map((dh) => ({
    id: `${detailId}-${dh.peraturanId}`,
    sopDetailId: detailId,
    peraturanId: dh.peraturanId,
    judul: dh.peraturan.tentang,
    nomor: String(dh.peraturan.nomor),
    tahun: String(dh.peraturan.tahun),
    createdAt: toIso(dh.createdAt),
    updatedAt: toIso(dh.updatedAt),
  }));
  const dasarHukumPeraturanIds = dasarHukumSorted.map((dh) => dh.peraturanId);
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
  const sopTerkaitDetailIds = relasiSopKeluarSorted.map((rel) => rel.detailSopTerkaitId);
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
  const swimlanes = row.swimlanes.map((sw) => ({
    id: `${sw.detailSopId}-${sw.pelaksanaId}`,
    sopDetailId: sw.detailSopId,
    pelaksanaId: sw.pelaksanaId,
    urutan: sw.urutan,
    createdAt: toIso(sw.createdAt),
    updatedAt: toIso(sw.updatedAt),
    pelaksana: {
      id: sw.pelaksana.pelaksanaId,
      opdId: sw.pelaksana.opdId,
      namaPelaksana: sw.pelaksana.nama,
    },
  }));
  const nilaiEvaluasi = row.nilaiEvaluasi.map((n) => ({
    id: buildNilaiEvaluasiClientId(n.pengajuanEvaluasiId, n.detailSopId),
    hasil: n.hasil === null || n.hasil === undefined ? undefined : String(n.hasil),
    catatan: n.catatan ?? undefined,
  }));
  const kp = row.sop.opd?.pengguna[0];
  const kepalaOpd: PenyusunWorkbenchDataDto['detail']['kepalaOpd'] =
    kp === null || kp === undefined ? null : { nama: kp.nama ?? null, nip: kp.nip ?? null };
  const statusDisplay = displayStatusSop(row.status);
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
    sop: sopHeader,
    dibuatOleh:
      row.dibuatOleh === null
        ? undefined
        : { id: row.dibuatOleh.penggunaId, nama: row.dibuatOleh.nama },
    terakhirDieditOleh:
      row.terakhirDieditOleh === null
        ? undefined
        : { id: row.terakhirDieditOleh.penggunaId, nama: row.terakhirDieditOleh.nama },
    lampiran,
    dasarHukum,
    relasiSopKeluar,
    relasiSopMasuk,
    swimlanes,
    nilaiEvaluasi,
    kepalaOpd,
    dasarHukumPeraturanIds,
    sopTerkaitDetailIds,
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
  const logEdit: PenyusunWorkbenchDataDto['logEdit'] = row.logEditSop.map((log) => {
    const fields = log.domainFields.map((f) => f.domainField).sort();
    const count = log.sesiChangeCount;
    return {
      id: encodeLogEditSopClientId(log.detailSopId, log.penggunaId, log.createdAt),
      sopDetailId: log.detailSopId,
      userId: log.penggunaId,
      bagian: log.bagian,
      keterangan: log.keterangan ?? null,
      meta: fields.length === 0 && count === 0 ? null : { fields, count },
      aktorRole: String(log.pengguna.peran),
      createdAt: toIso(log.createdAt),
      closedAt: log.closedAt instanceof Date ? toIso(log.closedAt) : null,
      user: {
        id: log.pengguna.penggunaId,
        nama: log.pengguna.nama,
        email: log.pengguna.email,
      },
    };
  });

  let tteSignaturePayloadKepalaOpd: BeritaAcaraTteSignaturePayloadDto | undefined;
  if (row.dokumenTte && row.dokumenTte.length > 0) {
    const dokTte = row.dokumenTte[0];
    for (const rt of dokTte.riwayatTandaTangan) {
      if (rt.peran === PeranPengguna.KEPALA_OPD && rt.user) {
        tteSignaturePayloadKepalaOpd = {
          id: `${rt.dokumenTteId}:${rt.userId}`,
          dokumenTteId: rt.dokumenTteId,
          userId: rt.userId,
          nip: rt.user.nip,
          namaLengkap: rt.user.nama,
          jabatan: rt.user.jabatan,
          signedAt: toIso(rt.ditandatanganiPada),
        };
        break;
      }
    }
  }

  return {
    detail,
    langkah,
    logEdit,
    diagramKonfigurasi: mapDiagramConfigsToWorkbenchDto(row.konfigurasiDiagram),
    tteSignaturePayloadKepalaOpd,
  };
}

export function mapVersiSlice(slice: {
  detailSopId: string;
  versi: number;
  nomorSOP: string;
  status: string;
}): SopDaftarVersiSliceDto {
  const statusDisplay = displayStatusSop(slice.status);
  return {
    detailSopId: slice.detailSopId,
    versi: slice.versi,
    nomorSop: slice.nomorSOP,
    status: statusDisplay.value,
    statusLabel: statusDisplay.label,
  };
}

export function mapDaftarRow(row: SopDaftarDbRow): SopDaftarRowDto {
  const d = row.detail;
  const inFlight = hasRevisiInFlight(row.allStatuses);
  const hasTerminalSource = row.allStatuses.some((status) => TERMINAL_DETAIL_STATUSES.has(status));
  const canBuatVersiBaru = hasTerminalSource && !inFlight;
  const canCabutSop =
    row.versiBerlaku !== null && row.versiBerlaku.status === StatusSOP.BERLAKU && !inFlight;
  const canHapusSopDraft =
    d !== undefined &&
    d.status === StatusSOP.DRAFT &&
    d.versi === 1 &&
    row.allStatuses.length === 1;
  if (d === undefined) {
    const statusDisplay = displayStatusSop('DRAFT');
    return {
      id: row.sopId,
      opdId: row.opdId,
      detailSopId: null,
      judul: row.judul,
      nomorSop: null,
      versi: null,
      pembuat: null,
      terakhirDiedit: { nama: null, waktu: null },
      status: statusDisplay.value,
      statusLabel: statusDisplay.label,
      peraturanId: null,
      terakhirDiperbarui: null,
      versiBerlaku: null,
      canBuatVersiBaru: false,
      canCabutSop: false,
      canHapusSopDraft: false,
    };
  }
  const waktuIso = d.updatedAt.toISOString();
  const statusDisplay = displayStatusSop(d.status);
  return {
    id: row.sopId,
    opdId: row.opdId,
    detailSopId: d.detailSopId,
    judul: row.judul,
    nomorSop: d.nomorSOP,
    versi: d.versi,
    pembuat: d.pembuatNama,
    terakhirDiedit: {
      nama: d.editorNama,
      waktu: waktuIso,
    },
    status: statusDisplay.value,
    statusLabel: statusDisplay.label,
    peraturanId: d.peraturanId,
    terakhirDiperbarui: waktuIso,
    versiBerlaku: row.versiBerlaku === null ? null : mapVersiSlice(row.versiBerlaku),
    canBuatVersiBaru,
    canCabutSop,
    canHapusSopDraft,
  };
}
