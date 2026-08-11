import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { PeranPengguna } from '../../generated/prisma';
import type { JwtAccessPayload } from '../types/jwt-access-payload.type';

/** Kunci metadata decorator `@Roles()` — diekspor untuk decorator dan uji. */
export const ROLES_METADATA_KEY = 'peran_diizinkan';

/**
 * Otorisasi berdasarkan `@Roles(...)`.
 * Tanpa metadata peran di handler/kelas: lolos (asumsi sudah dilindungi JWT atau route publik tidak memakai guard ini).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<PeranPengguna[]>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed === undefined || allowed.length === 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request & { user?: JwtAccessPayload }>();
    const user = req.user;
    if (user === undefined) {
      throw new ForbiddenException('Autentikasi diperlukan untuk mengakses sumber ini');
    }
    if (!allowed.includes(user.peran)) {
      throw new ForbiddenException('Peran Anda tidak memiliki akses ke operasi ini');
    }
    return true;
  }
}
