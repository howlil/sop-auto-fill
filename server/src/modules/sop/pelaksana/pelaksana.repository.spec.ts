import { PelaksanaRepository } from './pelaksana.repository';

function makeRepository() {
  const prisma = {
    pelaksana: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    langkahSOP: { count: jest.fn() },
    detailSOPPelaksana: { count: jest.fn() },
  };
  return { repository: new PelaksanaRepository(prisma as any), prisma };
}

describe('PelaksanaRepository workspace model', () => {
  it('mengambil pelaksana hanya dari workspace yang diminta', async () => {
    const { repository, prisma } = makeRepository();
    prisma.pelaksana.findMany.mockResolvedValue([]);

    await repository.findManyByWorkspaceId('workspace-1');

    expect(prisma.pelaksana.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' },
      orderBy: { nama: 'asc' },
    });
  });

  it('memverifikasi ownership melalui relasi workspace', async () => {
    const { repository, prisma } = makeRepository();
    prisma.pelaksana.findFirst.mockResolvedValue(null);

    await repository.findOwnedByUser('pelaksana-1', 'user-1');

    expect(prisma.pelaksana.findFirst).toHaveBeenCalledWith({
      where: {
        pelaksanaId: 'pelaksana-1',
        workspace: { ownerId: 'user-1' },
      },
    });
  });

  it('membuat pelaksana dengan workspaceId', async () => {
    const { repository, prisma } = makeRepository();
    prisma.pelaksana.create.mockResolvedValue({});

    await repository.create('workspace-1', 'Staf Administrasi');

    expect(prisma.pelaksana.create).toHaveBeenCalledWith({
      data: { workspaceId: 'workspace-1', nama: 'Staf Administrasi' },
    });
  });

  it('menghitung referensi langkah dan swimlane sebelum penghapusan', async () => {
    const { repository, prisma } = makeRepository();
    prisma.langkahSOP.count.mockResolvedValue(2);
    prisma.detailSOPPelaksana.count.mockResolvedValue(1);

    await expect(repository.countLangkahReferences('pelaksana-1')).resolves.toBe(2);
    await expect(repository.countSwimlaneReferences('pelaksana-1')).resolves.toBe(1);
    expect(prisma.langkahSOP.count).toHaveBeenCalledWith({
      where: { pelaksanaId: 'pelaksana-1' },
    });
    expect(prisma.detailSOPPelaksana.count).toHaveBeenCalledWith({
      where: { pelaksanaId: 'pelaksana-1' },
    });
  });
});
