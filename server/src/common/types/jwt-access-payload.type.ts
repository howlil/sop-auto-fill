import type { PeranPengguna } from '../../generated/prisma';

/** Isi muatan data JWT akses (sesuai yang ditandatangani di layanan auth). */
export type JwtAccessPayload = {
  readonly sub: string;
  readonly email: string;
  readonly peran: PeranPengguna;
  readonly sesiTokenVersion?: number;
};
