import type { PrismaService } from '../../../common/prisma/prisma.service';
import { PelaksanaRepository } from './pelaksana.repository';

describe('Pengujian PelaksanaRepository', () => {
  const prismaMock = {
    pengguna: {
      findFirst: jest.fn(),
    },
    pelaksana: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    langkahSOP: {
      count: jest.fn(),
    },
    detailSOPPelaksana: {
      count: jest.fn(),
    },
  };
  let repo: PelaksanaRepository;

  const selectPelaksana = {
    pelaksanaId: true,
    opdId: true,
    nama: true,
    createdAt: true,
    updatedAt: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PelaksanaRepository(prismaMock as unknown as PrismaService);
  });

  it('seharusnya mencari OPD pengguna aktif berdasarkan id pengguna', async () => {
    prismaMock.pengguna.findFirst.mockResolvedValueOnce({ opdId: 'opd-1' });

    const actual = await repo.findOpdIdByPenggunaId('user-1');

    expect(prismaMock.pengguna.findFirst).toHaveBeenCalledWith({
      where: { penggunaId: 'user-1', deletedAt: null },
      select: { opdId: true },
    });
    expect(actual).toBe('opd-1');
  });

  it('seharusnya mengembalikan null ketika pengguna aktif tidak ditemukan', async () => {
    prismaMock.pengguna.findFirst.mockResolvedValueOnce(null);

    await expect(repo.findOpdIdByPenggunaId('missing')).resolves.toBeNull();
  });

  it('seharusnya mencari daftar pelaksana per OPD berurutan nama', async () => {
    await repo.findManyByOpdId('opd-1');

    expect(prismaMock.pelaksana.findMany).toHaveBeenCalledWith({
      where: { opdId: 'opd-1' },
      select: selectPelaksana,
      orderBy: { nama: 'asc' },
    });
  });

  it('seharusnya mencari pelaksana berdasarkan id dan OPD', async () => {
    await repo.findByIdAndOpd('pl-1', 'opd-1');

    expect(prismaMock.pelaksana.findFirst).toHaveBeenCalledWith({
      where: { pelaksanaId: 'pl-1', opdId: 'opd-1' },
      select: selectPelaksana,
    });
  });

  it('seharusnya membuat pelaksana dengan opdId dan nama', async () => {
    await repo.create('opd-1', 'Staf A');

    expect(prismaMock.pelaksana.create).toHaveBeenCalledWith({
      data: { opdId: 'opd-1', nama: 'Staf A' },
      select: selectPelaksana,
    });
  });

  it('seharusnya memperbarui nama pelaksana berdasarkan id', async () => {
    await repo.updateNama('pl-1', 'Staf B');

    expect(prismaMock.pelaksana.update).toHaveBeenCalledWith({
      where: { pelaksanaId: 'pl-1' },
      data: { nama: 'Staf B' },
      select: selectPelaksana,
    });
  });

  it('seharusnya menghapus pelaksana berdasarkan id', async () => {
    await repo.delete('pl-1');

    expect(prismaMock.pelaksana.delete).toHaveBeenCalledWith({
      where: { pelaksanaId: 'pl-1' },
    });
  });

  it('seharusnya menghitung referensi pelaksana pada langkah dan swimlane', async () => {
    prismaMock.langkahSOP.count.mockResolvedValueOnce(2);
    prismaMock.detailSOPPelaksana.count.mockResolvedValueOnce(3);

    await expect(repo.countLangkahReferences('pl-1')).resolves.toBe(2);
    await expect(repo.countSwimlaneReferences('pl-1')).resolves.toBe(3);
    expect(prismaMock.langkahSOP.count).toHaveBeenCalledWith({ where: { pelaksanaId: 'pl-1' } });
    expect(prismaMock.detailSOPPelaksana.count).toHaveBeenCalledWith({
      where: { pelaksanaId: 'pl-1' },
    });
  });
});
