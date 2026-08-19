import type { JenisLangkahProsedur, SatuanWaktu, StatusSOP } from '../../../generated/prisma';

export type SopDraftStep = {
  urutan: number;
  kegiatan: string;
  jenis: JenisLangkahProsedur;
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: SatuanWaktu;
  keterangan: string;
  actorName: string;
  targetYaUrutan: number | null;
  targetTidakUrutan: number | null;
};

export type SopDraftDefinition = {
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actorNames: string[];
  steps: SopDraftStep[];
};

export type SopDraftCreateIdentity = {
  sopId: string;
  detailSopId: string;
  workspaceId: string;
  status: StatusSOP;
};

export type InstantiateSopDraftParams = {
  definition: SopDraftDefinition;
  workspaceId: string;
  userId: string;
  judul: string;
  nomorSop: string;
  namaLembaga: string;
};
