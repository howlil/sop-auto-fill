import type { PrismaService } from '../../../common/prisma/prisma.service';
import { AuthRepository } from './auth.repository';

describe('Pengujian AuthRepository', () => {
  const prismaMock = {
    pengguna: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  let repo: AuthRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AuthRepository(prismaMock as unknown as PrismaService);
  });

  it('seharusnya mencari pengguna aktif berdasarkan email', async () => {
    prismaMock.pengguna.findFirst.mockResolvedValueOnce({ penggunaId: 'p-1' });
    await repo.findActivePenggunaByEmail('user@example.test');
    expect(prismaMock.pengguna.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'user@example.test',
        deletedAt: null,
      },
    });
  });

  it('seharusnya mencari pengguna aktif berdasarkan id', async () => {
    prismaMock.pengguna.findFirst.mockResolvedValueOnce({ penggunaId: 'p-1' });
    await repo.findActivePenggunaById('p-1');
    expect(prismaMock.pengguna.findFirst).toHaveBeenCalledWith({
      where: {
        penggunaId: 'p-1',
        deletedAt: null,
      },
    });
  });

  it('seharusnya update password, menaikkan versi sesi, dan menghapus refresh token', async () => {
    prismaMock.pengguna.update.mockResolvedValueOnce({ penggunaId: 'p-1' });
    await repo.updateKataSandi('p-1', 'new-password-hash');
    expect(prismaMock.pengguna.update).toHaveBeenCalledWith({
      where: { penggunaId: 'p-1' },
      data: {
        kataSandi: 'new-password-hash',
        passwordChangedAt: expect.any(Date) as Date,
        sesiTokenVersion: { increment: 1 },
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  });

  it('seharusnya memperbarui hanya nomor HP pengguna', async () => {
    prismaMock.pengguna.update.mockResolvedValueOnce({
      penggunaId: 'p-1',
      nohp: '6281234567890',
    });

    const actual = await repo.updateNohp('p-1', '6281234567890');

    expect(prismaMock.pengguna.update).toHaveBeenCalledWith({
      where: { penggunaId: 'p-1' },
      data: { nohp: '6281234567890' },
    });
    expect(actual.nohp).toBe('6281234567890');
  });

  it('seharusnya startSession menaikkan versi sesi dan menghapus refresh token lama', async () => {
    prismaMock.pengguna.update.mockResolvedValueOnce({ penggunaId: 'p-1' });
    await repo.startSession('p-1');
    expect(prismaMock.pengguna.update).toHaveBeenCalledWith({
      where: { penggunaId: 'p-1' },
      data: {
        sesiTokenVersion: { increment: 1 },
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  });

  it('seharusnya menyimpan hash refresh token dan masa berlaku', async () => {
    const expiresAt = new Date('2026-05-01T00:00:00.000Z');
    prismaMock.pengguna.update.mockResolvedValueOnce({ penggunaId: 'p-1' });
    await repo.storeRefreshToken('p-1', 'refresh-hash', expiresAt);
    expect(prismaMock.pengguna.update).toHaveBeenCalledWith({
      where: { penggunaId: 'p-1' },
      data: {
        refreshTokenHash: 'refresh-hash',
        refreshTokenExpiresAt: expiresAt,
      },
    });
  });

  it('seharusnya revokeSession menaikkan versi sesi dan menghapus refresh token', async () => {
    prismaMock.pengguna.update.mockResolvedValueOnce({ penggunaId: 'p-1' });
    await repo.revokeSession('p-1');
    expect(prismaMock.pengguna.update).toHaveBeenCalledWith({
      where: { penggunaId: 'p-1' },
      data: {
        sesiTokenVersion: { increment: 1 },
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
  });
});
