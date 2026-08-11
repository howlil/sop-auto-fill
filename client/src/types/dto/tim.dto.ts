export type StatusTim = "AKTIF" | "NONAKTIF";

/** Item penyusun pada GET /api/v1/penyusun (per grup OPD). */
export interface PenyusunPublikItem {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  pangkat: string;
  email: string;
  nohp: string;
  peran: "PENYUSUN" | "PJ_PENYUSUN";
  status: StatusTim;
}

/** Grup OPD dari GET /api/v1/penyusun */
export interface TimPenyusunOpdGrup {
  opdId: string;
  namaOpd: string;
  penyusun: PenyusunPublikItem[];
}

/** GET /api/v1/penyusun/:id/riwayat-opd — OPD yang pernah terikat (penempatan / mutasi). */
export interface RiwayatOpdPenyusunItem {
  opdId: string;
  namaOpd: string;
  pertamaDicatat: string;
  terakhirDiperbarui: string;
  /** Selaras `Pengguna.opdId` */
  isAktif: boolean;
}

/** POST /api/v1/penyusun */
export interface CreatePenggunaPenyusunDto {
  opdId: string;
  nama: string;
  nip: string;
  peran: "PENYUSUN" | "PJ_PENYUSUN";
  pangkat: string;
  jabatan: string;
  email: string;
  nohp: string;
}

/** PATCH /api/v1/penyusun/:id */
export interface UpdatePenggunaPenyusunDto {
  email?: string;
  nama?: string;
  nip?: string;
  peran?: "PENYUSUN" | "PJ_PENYUSUN";
  pangkat?: string;
  jabatan?: string;
  nohp?: string;
  status?: StatusTim;
}

export interface UpdatePenyusunMutationDto {
  id: string;
  payload: UpdatePenggunaPenyusunDto;
}

export interface EvaluatorAnggota {
  id: string;
  userId: string;
  status: StatusTim;
  tanggalBergabung: string;
  berakhirPada?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    nama: string;
    email: string;
    nip: string;
    jabatan: string;
    pangkat: string;
    nohp: string;
    peran: string;
  };
}

export interface PindahTimPenyusunDto {
  opdId: string;
}

export interface PindahTimPenyusunMutationDto {
  id: string;
  opdId: string;
}

/** Payload tambah anggota evaluator Biro; opdId dan sandi default di server. */
export interface CreateEvaluatorAnggotaDto {
  email: string;
  nama: string;
  nip: string;
  jabatan: string;
  pangkat: string;
  nohp: string;
}

/** Payload pembaruan profil anggota evaluator. */
export interface UpdateEvaluatorAnggotaDto {
  email?: string;
  nama?: string;
  nip?: string;
  jabatan?: string;
  pangkat?: string;
  nohp?: string;
  status?: StatusTim;
}

export interface UpdateEvaluatorAnggotaMutationDto {
  id: string;
  payload: UpdateEvaluatorAnggotaDto;
}

/** Grup evaluator dari GET /api/v1/evaluator */
export interface EvaluatorOpdGrup {
  opdId: string;
  namaOpd: string;
  evaluator: EvaluatorAnggota[];
}
