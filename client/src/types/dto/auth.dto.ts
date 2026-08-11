import type { PeranPengguna } from "@/types/dto/access.dto";

export interface LoginRequest {
  email: string;
  kataSandi: string;
}

/** Bungkus respons API standar server */
export interface ApiSuccessResponse<T> {
  message: string;
  success: boolean;
  data: T;
}

export interface PublicPenggunaTteStatus {
  configured: boolean;
  pinSetAt?: string;
}

/** Payload `data` dari POST /auth/login (mirror server PublicPengguna) */
export interface PublicPenggunaLoginData {
  penggunaId: string;
  email: string;
  nama: string;
  peran: PeranPengguna;
  opdId: string;
  nip: string;
  jabatan: string;
  pangkat: string;
  nohp: string;
  tte: PublicPenggunaTteStatus;
}

export type LoginApiResponse = ApiSuccessResponse<PublicPenggunaLoginData>;

export interface LoginRequestDto {
  email: string;
  kataSandi: string;
}

export interface ChangePasswordDto {
  kataSandiLama: string;
  kataSandiBaru: string;
}

export interface UpdateMyPhoneDto {
  nohp: string;
}
