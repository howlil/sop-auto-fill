import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { StatusSOP } from '../../../generated/prisma';
import { SopProsedurService } from './sop-prosedur.service';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

function makeService() {
  const repo = {
    findDetailIdByDetailOrSopId: jest.fn().mockResolvedValue({
      detailSopId: 'detail-1',
      workspaceId: 'workspace-1',
      ownerId: 'user-1',
      status: StatusSOP.DRAFT,
    }),
    findPelaksanaIdsByWorkspace: jest.fn(),
    findExistingSwimlanePelaksanaIds: jest.fn(),
    updateProsedurTransaction: jest.fn().mockResolvedValue(undefined),
  };
  const workbench = { detail: { id: 'detail-1' } };
  const catalog = { getPenyusunWorkbench: jest.fn().mockResolvedValue(workbench) };
  return {
    service: new SopProsedurService(repo as any, catalog as any),
    repo,
    catalog,
    workbench,
  };
}

describe('SopProsedurService workspace model', () => {
  it('menolak detail yang tidak ditemukan atau bukan milik user', async () => {
    const { service, repo } = makeService();
    repo.findDetailIdByDetailOrSopId.mockResolvedValue({
      detailSopId: 'detail-1',
      workspaceId: 'workspace-1',
      ownerId: 'user-lain',
      status: StatusSOP.DRAFT,
    });

    await expect(service.updateProsedur(user, 'detail-1', {} as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('mengembalikan workbench tanpa transaksi jika tidak ada perubahan', async () => {
    const { service, repo, catalog, workbench } = makeService();

    await expect(service.updateProsedur(user, 'detail-1', {} as any)).resolves.toBe(workbench);
    expect(repo.updateProsedurTransaction).not.toHaveBeenCalled();
    expect(catalog.getPenyusunWorkbench).toHaveBeenCalledWith(user, 'detail-1', undefined);
  });

  it('menolak pelaksana duplikat sebelum menulis transaksi', async () => {
    const { service, repo } = makeService();

    await expect(
      service.updateProsedur(user, 'detail-1', {
        pelaksana: [{ pelaksanaId: 'p-1' }, { pelaksanaId: 'p-1' }],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateProsedurTransaction).not.toHaveBeenCalled();
  });

  it('memastikan pelaksana berasal dari workspace SOP sebelum menyimpan', async () => {
    const { service, repo, workbench } = makeService();
    repo.findPelaksanaIdsByWorkspace.mockResolvedValue(new Set(['p-1']));

    await expect(
      service.updateProsedur(user, 'detail-1', {
        pelaksana: [{ pelaksanaId: 'p-1' }],
      } as any),
    ).resolves.toBe(workbench);

    expect(repo.findPelaksanaIdsByWorkspace).toHaveBeenCalledWith('workspace-1', ['p-1']);
    expect(repo.updateProsedurTransaction).toHaveBeenCalledWith({
      detailSopId: 'detail-1',
      userId: 'user-1',
      input: { pelaksana: [{ pelaksanaId: 'p-1' }] },
      changedFields: ['pelaksana'],
    });
  });

  it('menolak pelaksana dari workspace lain', async () => {
    const { service, repo } = makeService();
    repo.findPelaksanaIdsByWorkspace.mockResolvedValue(new Set());

    await expect(
      service.updateProsedur(user, 'detail-1', {
        pelaksana: [{ pelaksanaId: 'p-lain' }],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
