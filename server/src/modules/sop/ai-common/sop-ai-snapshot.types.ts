import type { StatusSOP } from '../../../generated/prisma';

export type SopAiProcedureStepKind = 'AWAL_AKHIR' | 'KEGIATAN' | 'KEPUTUSAN';
export type SopAiProcedureTimeUnit = 'm' | 'h' | 'd' | 'w' | 'mo' | 'y';

export interface SopAiSnapshotActor {
  pelaksanaId: string;
  name: string;
  order: number;
}

export interface SopAiSnapshotStep {
  langkahSopId: string;
  urutan: number;
  kegiatan: string;
  jenis: SopAiProcedureStepKind;
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: SopAiProcedureTimeUnit;
  keterangan: string;
  actorName: string;
  targetYaUrutan: number | null;
  targetTidakUrutan: number | null;
}

export interface SopAiSnapshot {
  detailSopId: string;
  versi: number;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actors: SopAiSnapshotActor[];
  steps: SopAiSnapshotStep[];
}

export interface SopAiSnapshotContext {
  ownerId: string;
  status: StatusSOP;
  snapshot: SopAiSnapshot;
}
