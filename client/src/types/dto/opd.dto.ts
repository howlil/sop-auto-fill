/** OPD ringkas (GET list & GET by id) — selaras server. */
export interface OpdRingkas {
  id: string;
  nama: string;
}

/** OPD setelah create/update - selaras server. */
export interface OpdMutasi {
  id: string;
  nama: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpdDto {
  nama: string;
}

export interface UpdateOpdDto {
  nama: string;
}

export interface UpdateOpdMutationDto {
  id: string;
  payload: UpdateOpdDto;
}
