import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PeranPengguna } from '../../generated/prisma';
import { ROLES_METADATA_KEY, RolesGuard } from './roles.guard';

function buildContext(user: { peran: PeranPengguna } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('Pengujian RolesGuard', () => {
  it('seharusnya mengizinkan ketika tidak ada peran metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const actual = guard.canActivate(buildContext({ peran: PeranPengguna.PENYUSUN }));
    expect(actual).toBe(true);
  });

  it('seharusnya mengizinkan akses ketika peran pengguna termasuk dalam daftar peran yang diperbolehkan', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === ROLES_METADATA_KEY ? [PeranPengguna.PJ_EVALUATOR] : undefined,
        ),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const actual = guard.canActivate(buildContext({ peran: PeranPengguna.PJ_EVALUATOR }));
    expect(actual).toBe(true);
  });

  it('seharusnya melempar error ketika peran required tetapi peran tidak cocok', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === ROLES_METADATA_KEY ? [PeranPengguna.PJ_EVALUATOR] : undefined,
        ),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext({ peran: PeranPengguna.EVALUATOR }))).toThrow(
      ForbiddenException,
    );
  });

  it('seharusnya melempar error ketika peran required tetapi pengguna tidak ditemukan', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockImplementation((key: string) =>
          key === ROLES_METADATA_KEY ? [PeranPengguna.PJ_EVALUATOR] : undefined,
        ),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });
  it('seharusnya mengizinkan ketika metadata peran diset sebagai array kosong (Edge Case)', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const actual = guard.canActivate(buildContext({ peran: PeranPengguna.PENYUSUN }));
    expect(actual).toBe(true);
  });
});
