import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { StatusSOP } from '../../../generated/prisma';
import { SopCatalogService } from './sop-catalog.service';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

function makeService() {
  const repo = {
    findDaftarByWorkspaceId: jest.fn(),
    createSopWithInitialDetail: jest.fn(),
    findWorkbenchPayloadByDetailOrSopId: jest.fn(),
    findProjectContext: jest.fn(),
    updateSopHeaderTransaction: jest.fn(),
    updateSopStatus: jest.fn(),
    findRiwayatVersiBySopId: jest.fn(),
    cloneDetailSopFromSource: jest.fn(),
    deleteVersiDraft: jest.fn(),
    deleteSopDraftAwal: jest.fn(),
  };
  const workspace = { assertOwner: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new SopCatalogService(repo as any, workspace as any),
    repo,
    workspace,
  };
}

describe('SopCatalogService workspace model', () => {
  it('memvalidasi ownership workspace sebelum menampilkan daftar SOP', async () => {
    const { service, repo, workspace } = makeService();
    repo.findDaftarByWorkspaceId.mockResolvedValue([]);

    await expect(
      service.listForCurrentUser(user, { workspaceId: 'workspace-1' } as any),
    ).resolves.toEqual([]);

    expect(workspace.assertOwner).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(repo.findDaftarByWorkspaceId).toHaveBeenCalledWith('workspace-1', {
      status: undefined,
      tanggalDari: undefined,
      tanggalSampai: undefined,
    });
  });

  it('menolak rentang tanggal daftar yang terbalik', async () => {
    const { service, repo } = makeService();

    await expect(
      service.listForCurrentUser(user, {
        workspaceId: 'workspace-1',
        tanggalDari: '2026-08-10',
        tanggalSampai: '2026-08-01',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findDaftarByWorkspaceId).not.toHaveBeenCalled();
  });

  it('membuat SOP awal di workspace milik user', async () => {
    const { service, repo, workspace } = makeService();
    repo.createSopWithInitialDetail.mockResolvedValue({
      sopId: 'sop-1',
      workspaceId: 'workspace-1',
      judul: 'SOP Pengujian',
      status: StatusSOP.DRAFT,
      detail: undefined,
      versionCount: 1,
    });

    const result = await service.createForPenyusun(user, {
      workspaceId: 'workspace-1',
      judul: 'SOP Pengujian',
      nomorSop: '001/SOP',
      namaLembaga: '  Biro Organisasi  ',
    } as any);

    expect(workspace.assertOwner).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(repo.createSopWithInitialDetail).toHaveBeenCalledWith({
      judul: 'SOP Pengujian',
      nomorSOP: '001/SOP',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      namaLembaga: 'Biro Organisasi',
    });
    expect(result).toMatchObject({
      id: 'sop-1',
      workspaceId: 'workspace-1',
      status: StatusSOP.DRAFT,
    });
  });

  it('menyembunyikan workbench yang bukan milik user', async () => {
    const { service, repo } = makeService();
    repo.findWorkbenchPayloadByDetailOrSopId.mockResolvedValue(null);

    await expect(service.getPenyusunWorkbench(user, 'detail-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hanya membuat versi baru dari SOP COMPLETED dan memuat draft hasil clone', async () => {
    const { service, repo } = makeService();
    repo.findProjectContext.mockResolvedValue({
      detailSopId: 'detail-1',
      sopId: 'sop-1',
      ownerId: 'user-1',
      status: StatusSOP.COMPLETED,
    });
    repo.cloneDetailSopFromSource.mockResolvedValue({
      ok: true,
      data: { detailSopId: 'detail-2', versi: 2 },
      value: { detailSopId: 'detail-2', versi: 2 },
    });
    const clonedWorkbench = { detail: { id: 'detail-2', versi: 2 } } as any;
    jest.spyOn(service, 'getPenyusunWorkbench').mockResolvedValue(clonedWorkbench);

    await expect(service.buatVersiBaru(user, 'detail-1')).resolves.toBe(clonedWorkbench);
    expect(repo.cloneDetailSopFromSource).toHaveBeenCalledWith({
      sourceDetailSopId: 'detail-1',
      userId: 'user-1',
    });
    expect(service.getPenyusunWorkbench).toHaveBeenCalledWith(user, 'detail-2', undefined);
  });

  it('menolak pembuatan versi baru ketika SOP belum COMPLETED', async () => {
    const { service, repo } = makeService();
    repo.findProjectContext.mockResolvedValue({
      detailSopId: 'detail-1',
      sopId: 'sop-1',
      ownerId: 'user-1',
      status: StatusSOP.DRAFT,
    });

    await expect(service.buatVersiBaru(user, 'detail-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.cloneDetailSopFromSource).not.toHaveBeenCalled();
  });
});
