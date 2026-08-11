/** Selaras server `KepalaOpdPublicDto` & endpoint `/kepala-opd`. */

export interface KepalaOpdDto {
  id: string
  nama: string
  nip: string
  email: string
  nohp: string
  jabatan: string
  pangkat: string
  opdId: string
  namaOpd: string
  isActive: boolean
  updatedAt: string
  /** Selaras server: boleh hapus jika belum ada Detail SOP terkait */
  dapatDihapus: boolean
}

export interface CreateKepalaOpdDto {
  opdId: string
  nama: string
  email: string
  nip: string
  jabatan: string
  pangkat: string
  nohp: string
}

export interface UpdateKepalaOpdDto {
  opdId?: string
  nama?: string
  email?: string
  nip?: string
  jabatan?: string
  pangkat?: string
  nohp?: string
  status?: 'AKTIF' | 'NONAKTIF'
}

export interface KepalaOpdRiwayatItemDto {
  opdId: string
  namaOpd: string
  dicatatPada: string
  diperbaruiPada: string
  /** Selaras `Pengguna.opdId` */
  isAktif: boolean
}
