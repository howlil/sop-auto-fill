import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { PeranPengguna } from '../../generated/prisma';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ROLES_METADATA_KEY, RolesGuard } from '../guards/roles.guard';

/** Menandai endpoint atau controller: hanya peran yang terdaftar yang boleh mengakses (setelah JWT valid). */
export function Roles(...peran: PeranPengguna[]): ReturnType<typeof SetMetadata> {
  return SetMetadata(ROLES_METADATA_KEY, peran);
}

export function UseJwtAndRolesGuards(): ReturnType<typeof applyDecorators> {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard));
}
