import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { assertSopCatalogRepoOk } from './sop-catalog-repo-error.util';
import { sopCatalogRepoFail, sopCatalogRepoOk } from './sop-catalog.repo-result';

describe('Pengujian assertSopCatalogRepoOk', () => {
  it('seharusnya mengembalikan data ketika result ok', () => {
    expect(assertSopCatalogRepoOk(sopCatalogRepoOk({ id: 'sop-1' }))).toEqual({ id: 'sop-1' });
  });

  it('seharusnya memetakan NOT_FOUND menjadi NotFoundException', () => {
    expect(() => assertSopCatalogRepoOk(sopCatalogRepoFail('NOT_FOUND', 'Tidak ditemukan'))).toThrow(
      NotFoundException,
    );
  });

  it('seharusnya memetakan CONFLICT menjadi ConflictException', () => {
    expect(() => assertSopCatalogRepoOk(sopCatalogRepoFail('CONFLICT', 'Konflik'))).toThrow(
      ConflictException,
    );
  });

  it.each(['BAD_REQUEST', 'INVALID_STATE'] as const)(
    'seharusnya memetakan %s menjadi BadRequestException',
    (reason) => {
      expect(() => assertSopCatalogRepoOk(sopCatalogRepoFail(reason, 'Tidak valid'))).toThrow(
        BadRequestException,
      );
    },
  );

  it('seharusnya memakai fallback BadRequestException untuk reason tidak dikenal', () => {
    expect(() =>
      assertSopCatalogRepoOk({
        ok: false,
        reason: 'UNKNOWN',
        message: 'Tidak valid',
      } as never),
    ).toThrow(BadRequestException);
  });
});
