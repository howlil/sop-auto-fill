import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { JenisDiagram, StatusSOP } from '../../../generated/prisma';
import { SopDiagramService } from './sop-diagram.service';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

function makeService() {
  const repo = {
    findDetailIdByDetailOrSopId: jest.fn().mockResolvedValue({
      detailSopId: 'detail-1',
      ownerId: 'user-1',
      status: StatusSOP.DRAFT,
    }),
    upsertConfig: jest.fn().mockResolvedValue(undefined),
  };
  const workbench = { detail: { id: 'detail-1' } };
  const catalog = { getPenyusunWorkbench: jest.fn().mockResolvedValue(workbench) };
  return {
    service: new SopDiagramService(repo as any, catalog as any),
    repo,
    catalog,
    workbench,
  };
}

describe('SopDiagramService owner model', () => {
  it('menolak diagram SOP yang bukan milik user', async () => {
    const { service, repo } = makeService();
    repo.findDetailIdByDetailOrSopId.mockResolvedValue({
      detailSopId: 'detail-1',
      ownerId: 'user-lain',
      status: StatusSOP.DRAFT,
    });

    await expect(
      service.updateDiagram(user, 'detail-1', { jenis: JenisDiagram.FLOWCHART } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mengembalikan workbench tanpa write ketika konfigurasi tidak berubah', async () => {
    const { service, repo, workbench } = makeService();

    await expect(
      service.updateDiagram(user, 'detail-1', { jenis: JenisDiagram.FLOWCHART } as any),
    ).resolves.toBe(workbench);
    expect(repo.upsertConfig).not.toHaveBeenCalled();
  });

  it('menyimpan layout seed lalu memuat ulang workbench', async () => {
    const { service, repo, catalog, workbench } = makeService();

    await expect(
      service.updateDiagram(user, 'detail-1', {
        jenis: JenisDiagram.FLOWCHART,
        layoutSeed: 7,
      }),
    ).resolves.toBe(workbench);

    expect(repo.upsertConfig).toHaveBeenCalledWith({
      detailSopId: 'detail-1',
      jenis: JenisDiagram.FLOWCHART,
      layoutSeed: 7,
      pathOverrides: undefined,
    });
    expect(catalog.getPenyusunWorkbench).toHaveBeenCalledWith(user, 'detail-1', undefined);
  });

  it('menolak kunci edge diagram yang tidak valid', async () => {
    const { service, repo } = makeService();

    await expect(
      service.updateDiagram(user, 'detail-1', {
        jenis: JenisDiagram.FLOWCHART,
        pathOverrides: {
          edges: {
            invalid: {
              sSide: 'right',
              eSide: 'left',
              startPoint: { x: 0, y: 0 },
              endPoint: { x: 10, y: 10 },
              bendPoints: [],
            },
          },
        },
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.upsertConfig).not.toHaveBeenCalled();
  });
});
