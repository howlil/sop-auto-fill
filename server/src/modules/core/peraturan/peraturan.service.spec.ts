import { ConflictException, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { PeraturanService } from './peraturan.service';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

const row = {
  peraturanId: 'peraturan-1',
  nama: 'PermenPANRB',
  nomor: '35',
  tahun: 2012,
  tentang: 'Pedoman Penyusunan SOP Administrasi Pemerintahan',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  dasarHukumCount: 0,
};

function makeService() {
  const repo = {
    findManyByOwner: jest.fn(),
    findOwnedById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new PeraturanService(repo as any), repo };
}

describe('PeraturanService owner model', () => {
  it('mengambil peraturan berdasarkan owner Google user', async () => {
    const { service, repo } = makeService();
    repo.findManyByOwner.mockResolvedValue([row]);

    await expect(service.list(user)).resolves.toEqual([
      expect.objectContaining({
        id: 'peraturan-1',
        namaPeraturan: 'PermenPANRB',
        digunakan: 0,
      }),
    ]);
    expect(repo.findManyByOwner).toHaveBeenCalledWith('user-1');
  });

  it('menggunakan ownerId saat membuat peraturan', async () => {
    const { service, repo } = makeService();
    repo.create.mockResolvedValue(row);

    await service.create(user, {
      namaPeraturan: 'PermenPANRB',
      nomor: '35',
      tahun: 2012,
      tentang: 'Pedoman Penyusunan SOP Administrasi Pemerintahan',
    } as any);

    expect(repo.create).toHaveBeenCalledWith({
      ownerId: 'user-1',
      nama: 'PermenPANRB',
      nomor: '35',
      tahun: 2012,
      tentang: 'Pedoman Penyusunan SOP Administrasi Pemerintahan',
    });
  });

  it('menyembunyikan peraturan yang bukan milik user', async () => {
    const { service, repo } = makeService();
    repo.findOwnedById.mockResolvedValue(null);

    await expect(service.getById(user, 'peraturan-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('menolak penghapusan peraturan yang masih digunakan SOP', async () => {
    const { service, repo } = makeService();
    repo.findOwnedById.mockResolvedValue({ ...row, dasarHukumCount: 2 });

    await expect(service.remove(user, 'peraturan-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
