import { ForbiddenException, Injectable } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { PeranPengguna } from '../../../generated/prisma';
import { OpdRepository } from './opd.repository';

@Injectable()
export class UserOpdAccessService {
  constructor(private readonly opdRepository: OpdRepository) {}

  isEvaluatorRole(role: PeranPengguna): boolean {
    return role === PeranPengguna.EVALUATOR || role === PeranPengguna.PJ_EVALUATOR;
  }

  isOpdScopedRole(role: PeranPengguna): boolean {
    return (
      role === PeranPengguna.PJ_PENYUSUN ||
      role === PeranPengguna.KEPALA_OPD ||
      role === PeranPengguna.PENYUSUN
    );
  }

  async getRequiredUserOpdId(
    penggunaId: string,
    notBoundMessage = 'Pengguna tidak terikat OPD',
  ): Promise<string> {
    const opdId = await this.opdRepository.findOpdIdByPenggunaId(penggunaId);
    if (opdId === null) {
      throw new ForbiddenException(notBoundMessage);
    }
    return opdId;
  }

  async assertSameOpd(
    penggunaId: string,
    targetOpdId: string,
    mismatchMessage = 'Akses ditolak untuk DetailSOP ini',
  ): Promise<void> {
    const ownOpdId = await this.getRequiredUserOpdId(penggunaId);
    if (ownOpdId !== targetOpdId) {
      throw new ForbiddenException(mismatchMessage);
    }
  }

  async resolveOwnOpdAllowingOptionalQuery(
    penggunaId: string,
    queryOpdId?: string,
    mismatchMessage = 'Tidak dapat mengakses OPD lain',
  ): Promise<string> {
    const ownOpdId = await this.getRequiredUserOpdId(penggunaId);
    if (queryOpdId !== undefined && queryOpdId !== '' && queryOpdId !== ownOpdId) {
      throw new ForbiddenException(mismatchMessage);
    }
    return ownOpdId;
  }

  async assertWorkbenchAccess(user: JwtAccessPayload, sopOpdId: string): Promise<void> {
    if (this.isEvaluatorRole(user.peran)) {
      return;
    }
    await this.assertSameOpd(user.sub, sopOpdId, 'Akses ditolak untuk DetailSOP ini');
  }
}
