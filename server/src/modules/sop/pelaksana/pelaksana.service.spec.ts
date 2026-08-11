import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PeranPengguna, Prisma } from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common';
import { UserOpdAccessService } from '../../core/opd/user-opd-access.service';
import { PelaksanaRepository } from './pelaksana.repository';
import { PelaksanaService } from './pelaksana.service';

describe('Pengujian PelaksanaService', () => {
  let service: PelaksanaService;

  const pelaksanaRepoMock = {
    findManyByOpdId: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    findByIdAndOpd: jest.fn(),
    updateNama: jest.fn(),
    countLangkahReferences: jest.fn(),
    countSwimlaneReferences: jest.fn(),
    delete: jest.fn(),
  };

  const userOpdAccessMock = {
    resolveOwnOpdAllowingOptionalQuery: jest.fn().mockResolvedValue('opd-1'),
  };

  const penyusunUser: JwtAccessPayload = {
    sub: 'u1',
    email: 'p@x.id',
    peran: PeranPengguna.PENYUSUN,
  };

  const baseRow = {
    pelaksanaId: 'pl-1',
    opdId: 'opd-1',
    nama: 'Staf A',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PelaksanaService(
      pelaksanaRepoMock as unknown as PelaksanaRepository,
      userOpdAccessMock as unknown as UserOpdAccessService,
    );
    userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery.mockResolvedValue('opd-1');
  });

  it('seharusnya menolak akses membuat ketika OPD query tidak cocok', async () => {
    userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery.mockRejectedValueOnce(
      new ForbiddenException('Akses OPD ditolak'),
    );
    await expect(
      service.create(penyusunUser, { opdId: 'opd-lain', namaPelaksana: 'X' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(pelaksanaRepoMock.create).not.toHaveBeenCalled();
  });

  it('seharusnya membuat pelaksana untuk OPD yang sudah ditentukan', async () => {
    pelaksanaRepoMock.create.mockResolvedValueOnce(baseRow);
    const actual = await service.create(penyusunUser, {
      opdId: 'opd-1',
      namaPelaksana: 'Staf A',
    });
    expect(actual.id).toBe('pl-1');
    expect(actual).toEqual({
      id: 'pl-1',
      opdId: 'opd-1',
      namaPelaksana: 'Staf A',
      createdAt: baseRow.createdAt.toISOString(),
      updatedAt: baseRow.updatedAt.toISOString(),
    });
    expect(pelaksanaRepoMock.create).toHaveBeenCalledWith('opd-1', 'Staf A');
  });

  it('seharusnya membuat pelaksana memakai OPD pengguna ketika dto tidak mengirim opdId (Edge Case)', async () => {
    pelaksanaRepoMock.create.mockResolvedValueOnce(baseRow);

    await service.create(penyusunUser, { namaPelaksana: 'Staf A' });

    expect(userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery).toHaveBeenCalledWith(
      penyusunUser.sub,
      undefined,
    );
    expect(pelaksanaRepoMock.create).toHaveBeenCalledWith('opd-1', 'Staf A');
  });

  it('seharusnya melempar ConflictException ketika nama pelaksana duplikat dalam OPD saat create', async () => {
    pelaksanaRepoMock.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '1',
      }),
    );

    await expect(service.create(penyusunUser, { namaPelaksana: 'Staf A' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('seharusnya mengembalikan daftar pelaksana terpetakan dan meneruskan query OPD opsional', async () => {
    const row2 = {
      ...baseRow,
      pelaksanaId: 'pl-2',
      nama: 'Staf B',
      createdAt: new Date('2024-01-03T00:00:00.000Z'),
      updatedAt: new Date('2024-01-04T00:00:00.000Z'),
    };
    pelaksanaRepoMock.findManyByOpdId.mockResolvedValueOnce([baseRow, row2]);

    const actual = await service.list(penyusunUser, 'opd-1');

    expect(userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery).toHaveBeenCalledWith(
      penyusunUser.sub,
      'opd-1',
    );
    expect(pelaksanaRepoMock.findManyByOpdId).toHaveBeenCalledWith('opd-1');
    expect(actual).toEqual([
      {
        id: 'pl-1',
        opdId: 'opd-1',
        namaPelaksana: 'Staf A',
        createdAt: baseRow.createdAt.toISOString(),
        updatedAt: baseRow.updatedAt.toISOString(),
      },
      {
        id: 'pl-2',
        opdId: 'opd-1',
        namaPelaksana: 'Staf B',
        createdAt: row2.createdAt.toISOString(),
        updatedAt: row2.updatedAt.toISOString(),
      },
    ]);
  });

  it('seharusnya mengembalikan array kosong saat list tidak punya data (Edge Case)', async () => {
    pelaksanaRepoMock.findManyByOpdId.mockResolvedValueOnce([]);

    await expect(service.list(penyusunUser)).resolves.toEqual([]);
  });

  it('seharusnya meneruskan ForbiddenException dari resolver OPD saat list query OPD tidak cocok (False Case)', async () => {
    userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery.mockRejectedValueOnce(
      new ForbiddenException('Akses OPD ditolak'),
    );

    await expect(service.list(penyusunUser, 'opd-lain')).rejects.toBeInstanceOf(ForbiddenException);
    expect(pelaksanaRepoMock.findManyByOpdId).not.toHaveBeenCalled();
  });

  it('seharusnya melempar NotFoundException ketika memperbarui pelaksana di luar OPD', async () => {
    pelaksanaRepoMock.findByIdAndOpd.mockResolvedValueOnce(null);
    await expect(
      service.update(penyusunUser, 'pl-x', { namaPelaksana: 'Baru' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pelaksanaRepoMock.updateNama).not.toHaveBeenCalled();
  });

  it('seharusnya memperbarui nama ketika pelaksana in OPD', async () => {
    pelaksanaRepoMock.findByIdAndOpd.mockResolvedValueOnce(baseRow);
    pelaksanaRepoMock.updateNama.mockResolvedValueOnce({ ...baseRow, nama: 'Staf B' });
    const actual = await service.update(penyusunUser, 'pl-1', { namaPelaksana: 'Staf B' });
    expect(actual.namaPelaksana).toBe('Staf B');
    expect(userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery).toHaveBeenCalledWith(
      penyusunUser.sub,
      undefined,
    );
    expect(pelaksanaRepoMock.findByIdAndOpd).toHaveBeenCalledWith('pl-1', 'opd-1');
    expect(pelaksanaRepoMock.updateNama).toHaveBeenCalledWith('pl-1', 'Staf B');
  });

  it('seharusnya melempar ConflictException ketika nama pelaksana duplikat dalam OPD saat update', async () => {
    pelaksanaRepoMock.findByIdAndOpd.mockResolvedValueOnce(baseRow);
    pelaksanaRepoMock.updateNama.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '1',
      }),
    );

    await expect(
      service.update(penyusunUser, 'pl-1', { namaPelaksana: 'Staf B' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('seharusnya tidak mengubah nama ketika resolver OPD gagal saat update (False Case)', async () => {
    userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery.mockRejectedValueOnce(
      new ForbiddenException('OPD pengguna tidak ditemukan'),
    );

    await expect(
      service.update(penyusunUser, 'pl-1', { namaPelaksana: 'Staf B' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(pelaksanaRepoMock.findByIdAndOpd).not.toHaveBeenCalled();
    expect(pelaksanaRepoMock.updateNama).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika menghapus data yang masih direferensikan', async () => {
    pelaksanaRepoMock.findByIdAndOpd.mockResolvedValueOnce(baseRow);
    pelaksanaRepoMock.countLangkahReferences.mockResolvedValueOnce(1);
    pelaksanaRepoMock.countSwimlaneReferences.mockResolvedValueOnce(0);
    await expect(service.remove(penyusunUser, 'pl-1')).rejects.toBeInstanceOf(ConflictException);
    expect(pelaksanaRepoMock.delete).not.toHaveBeenCalled();
  });

  it('seharusnya melempar NotFoundException ketika menghapus pelaksana yang tidak ada di OPD pengguna (False Case)', async () => {
    pelaksanaRepoMock.findByIdAndOpd.mockResolvedValueOnce(null);

    await expect(service.remove(penyusunUser, 'pl-x')).rejects.toBeInstanceOf(NotFoundException);
    expect(pelaksanaRepoMock.countLangkahReferences).not.toHaveBeenCalled();
    expect(pelaksanaRepoMock.countSwimlaneReferences).not.toHaveBeenCalled();
    expect(pelaksanaRepoMock.delete).not.toHaveBeenCalled();
  });

  it('seharusnya melempar ConflictException ketika pelaksana masih direferensikan sebagai swimlane (Worst Case)', async () => {
    pelaksanaRepoMock.findByIdAndOpd.mockResolvedValueOnce(baseRow);
    pelaksanaRepoMock.countLangkahReferences.mockResolvedValueOnce(0);
    pelaksanaRepoMock.countSwimlaneReferences.mockResolvedValueOnce(2);

    await expect(service.remove(penyusunUser, 'pl-1')).rejects.toBeInstanceOf(ConflictException);
    expect(pelaksanaRepoMock.delete).not.toHaveBeenCalled();
  });

  it('seharusnya menghapus pelaksana ketika tidak ada referensi langkah maupun swimlane (Success Case)', async () => {
    pelaksanaRepoMock.findByIdAndOpd.mockResolvedValueOnce(baseRow);
    pelaksanaRepoMock.countLangkahReferences.mockResolvedValueOnce(0);
    pelaksanaRepoMock.countSwimlaneReferences.mockResolvedValueOnce(0);
    pelaksanaRepoMock.delete.mockResolvedValueOnce(undefined);

    await service.remove(penyusunUser, 'pl-1');

    expect(userOpdAccessMock.resolveOwnOpdAllowingOptionalQuery).toHaveBeenCalledWith(
      penyusunUser.sub,
      undefined,
    );
    expect(pelaksanaRepoMock.findByIdAndOpd).toHaveBeenCalledWith('pl-1', 'opd-1');
    expect(pelaksanaRepoMock.countLangkahReferences).toHaveBeenCalledWith('pl-1');
    expect(pelaksanaRepoMock.countSwimlaneReferences).toHaveBeenCalledWith('pl-1');
    expect(pelaksanaRepoMock.delete).toHaveBeenCalledWith('pl-1');
  });
});
