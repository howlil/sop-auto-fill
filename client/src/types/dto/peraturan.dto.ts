export interface PeraturanResponse {
  id: string
  namaPeraturan: string
  nomor: string
  tahun: number
  tentang: string
  createdAt: string
  updatedAt: string
  digunakan?: number
}

export type Peraturan = PeraturanResponse

export interface CreatePeraturanDto {
  namaPeraturan: string
  nomor: string
  tahun: number
  tentang: string
}

export interface UpdatePeraturanDto {
  namaPeraturan?: string
  nomor?: string
  tahun?: number
  tentang?: string
}

export interface UpdatePeraturanMutationDto {
  id: string
  payload: UpdatePeraturanDto
}
