import { StatusSOP } from '../../../generated/prisma';
import { SopCatalogRepository } from './sop-catalog.repository';

function makeRepository() {
  const prisma = {
    sOP: { findMany: jest.fn() },
  };
  return { repository: new SopCatalogRepository(prisma as any), prisma };
}

const dbRow = {
  sopId: 'sop-1',
  workspaceId: 'workspace-1',
  judul: 'SOP Pengujian',
  status: StatusSOP.DRAFT,
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  detailSops: [
    {
      detailSopId: 'detail-1',
      nomorSOP: '001/SOP',
      versi: 1,
      updatedAt: new Date('2026-08-02T00:00:00.000Z'),
      dibuatOleh: { name: 'Pembuat' },
      terakhirDieditOleh: { name: 'Editor' },
      dasarHukum: [{ peraturanId: 'peraturan-1' }],
    },
  ],
};

describe('SopCatalogRepository workspace list', () => {
  it('mengambil dan memetakan SOP berdasarkan workspace', async () => {
    const { repository, prisma } = makeRepository();
    prisma.sOP.findMany.mockResolvedValue([dbRow]);

    await expect(repository.findDaftarByWorkspaceId('workspace-1')).resolves.toEqual([
      {
        sopId: 'sop-1',
        workspaceId: 'workspace-1',
        judul: 'SOP Pengujian',
        status: StatusSOP.DRAFT,
        versionCount: 1,
        detail: {
          detailSopId: 'detail-1',
          nomorSOP: '001/SOP',
          versi: 1,
          updatedAt: new Date('2026-08-02T00:00:00.000Z'),
          pembuatNama: 'Pembuat',
          editorNama: 'Editor',
          peraturanId: 'peraturan-1',
        },
      },
    ]);

    expect(prisma.sOP.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'workspace-1' } }),
    );
  });

  it('menerapkan filter status pada hasil workspace', async () => {
    const { repository, prisma } = makeRepository();
    prisma.sOP.findMany.mockResolvedValue([dbRow]);

    await expect(
      repository.findDaftarByWorkspaceId('workspace-1', { status: StatusSOP.COMPLETED }),
    ).resolves.toEqual([]);
  });

  it('menerapkan filter tanggal terhadap detail terbaru', async () => {
    const { repository, prisma } = makeRepository();
    prisma.sOP.findMany.mockResolvedValue([dbRow]);

    await expect(
      repository.findDaftarByWorkspaceId('workspace-1', { tanggalDari: '2026-08-03' }),
    ).resolves.toEqual([]);
    await expect(
      repository.findDaftarByWorkspaceId('workspace-1', { tanggalSampai: '2026-08-02' }),
    ).resolves.toHaveLength(1);
  });
});
