import type { PeranPengguna } from "@/types/dto/access.dto";

export interface User {
  id: string;
  email: string;
  nama: string;
  peran: PeranPengguna;
  opdId: string | null;
  nip: string;
  jabatan: string;
  pangkat: string;
  nohp: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserDto {
  email: string;
  nama: string;
  kataSandi?: string;
  peran: PeranPengguna;
  opdId?: string;
  nip?: string;
  jabatan?: string;
  pangkat?: string;
  nohp?: string;
}

export interface UpdateUserDto {
  email?: string;
  nama?: string;
  kataSandi?: string;
  peran?: PeranPengguna;
  opdId?: string;
  nip?: string;
  jabatan?: string;
  pangkat?: string;
  nohp?: string;
}

export interface UsersQueryParams {
  page?: number;
  limit?: number;
  opdId?: string;
  peran?: string;
  search?: string;
}

export interface UpdateUserMutationDto {
  id: string;
  payload: UpdateUserDto;
}
