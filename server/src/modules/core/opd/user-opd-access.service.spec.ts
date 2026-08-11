import { ForbiddenException } from '@nestjs/common';
import { PeranPengguna } from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common';
import { OpdRepository } from './opd.repository';
import { UserOpdAccessService } from './user-opd-access.service';

describe('Pengujian UserOpdAccessService', () => {
  const opdRepository: jest.Mocked<Pick<OpdRepository, 'findOpdIdByPenggunaId'>> = {
    findOpdIdByPenggunaId: jest.fn(),
  };
  let service: UserOpdAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserOpdAccessService(opdRepository as unknown as OpdRepository);
    opdRepository.findOpdIdByPenggunaId.mockResolvedValue('opd-1');
  });

  describe('isEvaluatorRole', () => {
    it('seharusnya mengembalikan true untuk EVALUATOR dan PJ_EVALUATOR', () => {
      expect(service.isEvaluatorRole(PeranPengguna.EVALUATOR)).toBe(true);
      expect(service.isEvaluatorRole(PeranPengguna.PJ_EVALUATOR)).toBe(true);
    });

    it('seharusnya mengembalikan false untuk peran lain', () => {
      expect(service.isEvaluatorRole(PeranPengguna.PENYUSUN)).toBe(false);
      expect(service.isEvaluatorRole(PeranPengguna.KEPALA_OPD)).toBe(false);
    });
  });

  describe('isOpdScopedRole', () => {
    it('seharusnya mengembalikan true untuk KEPALA_OPD, PJ_PENYUSUN, dan PENYUSUN', () => {
      expect(service.isOpdScopedRole(PeranPengguna.KEPALA_OPD)).toBe(true);
      expect(service.isOpdScopedRole(PeranPengguna.PJ_PENYUSUN)).toBe(true);
      expect(service.isOpdScopedRole(PeranPengguna.PENYUSUN)).toBe(true);
    });

    it('seharusnya mengembalikan false untuk peran non-OPD scoped', () => {
      expect(service.isOpdScopedRole(PeranPengguna.EVALUATOR)).toBe(false);
    });
  });

  describe('getRequiredUserOpdId', () => {
    it('seharusnya melempar error ketika pengguna belum terhubung ke OPD (False case)', async () => {
      opdRepository.findOpdIdByPenggunaId.mockResolvedValueOnce(null);
      await expect(service.getRequiredUserOpdId('u1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('seharusnya mengembalikan opdId ketika ditemukan', async () => {
      const result = await service.getRequiredUserOpdId('u1');
      expect(result).toBe('opd-1');
    });
  });

  describe('assertSameOpd', () => {
    it('seharusnya melempar ForbiddenException ketika OPD target tidak sama (False case)', async () => {
      await expect(service.assertSameOpd('u1', 'opd-lain')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('seharusnya melewati pengecekan ketika OPD target sama persis', async () => {
      await expect(service.assertSameOpd('u1', 'opd-1')).resolves.toBeUndefined();
    });
  });

  describe('resolveOwnOpdAllowingOptionalQuery', () => {
    it('seharusnya menolak query OPD tidak cocok (False case)', async () => {
      await expect(
        service.resolveOwnOpdAllowingOptionalQuery('u1', 'opd-lain'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('seharusnya mengembalikan OPD sendiri jika query string kosong (Edge case)', async () => {
      await expect(service.resolveOwnOpdAllowingOptionalQuery('u1', '')).resolves.toBe('opd-1');
    });

    it('seharusnya mengembalikan OPD sendiri jika query undefined', async () => {
      await expect(service.resolveOwnOpdAllowingOptionalQuery('u1', undefined)).resolves.toBe(
        'opd-1',
      );
    });

    it('seharusnya mengembalikan OPD sendiri jika query sama persis', async () => {
      await expect(service.resolveOwnOpdAllowingOptionalQuery('u1', 'opd-1')).resolves.toBe(
        'opd-1',
      );
    });
  });

  describe('assertWorkbenchAccess', () => {
    it('seharusnya melewati validasi workbench untuk evaluator', async () => {
      const user: JwtAccessPayload = {
        sub: 'ev-1',
        email: 'e@x.c',
        peran: PeranPengguna.EVALUATOR,
      };
      await expect(service.assertWorkbenchAccess(user, 'opd-lain')).resolves.toBeUndefined();
      expect(opdRepository.findOpdIdByPenggunaId).not.toHaveBeenCalled();
    });

    it('seharusnya melempar ForbiddenException untuk peran penyusun dengan OPD yang berbeda', async () => {
      const user: JwtAccessPayload = {
        sub: 'py-1',
        email: 'p@x.c',
        peran: PeranPengguna.PENYUSUN,
      };
      await expect(service.assertWorkbenchAccess(user, 'opd-lain')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('seharusnya mengijinkan akses untuk peran penyusun dengan OPD yang sama', async () => {
      const user: JwtAccessPayload = {
        sub: 'py-1',
        email: 'p@x.c',
        peran: PeranPengguna.PENYUSUN,
      };
      await expect(service.assertWorkbenchAccess(user, 'opd-1')).resolves.toBeUndefined();
    });
  });
});
