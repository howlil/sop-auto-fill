import { ConflictException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { PelaksanaService } from './pelaksana.service';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

const row = {
  pelaksanaId: 'pelaksana-1',
  workspaceId: 'workspace-1',
  nama: 'Staf Administrasi',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
};

function makeService() {
  const repo = {
    findManyByWorkspaceId: jest.fn(),
    findOwnedByUser: jest.fn(),
    create: jest.fn(),
    updateNama: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    countLangkahReferences: jest.fn().mockResolvedValue(0),
    countSwimlaneReferences: jest.fn().mockResolvedValue(0),
  };
  const workspace = { assertOwner: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new PelaksanaService(repo as any, workspace as any),
    repo,
    workspace,
  };
}

describe('PelaksanaService workspace model', () => {
  it('memvalidasi ownership workspace saat mengambil daftar pelaksana', async () => {
    const { service, repo, workspace } = makeService();
    repo.findManyByWorkspaceId.mockResolvedValue([row]);

    await expect(service.list(user, 'workspace-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'pelaksana-1',
        workspaceId: 'workspace-1',
        namaPelaksana: 'Staf Administrasi',
      }),
    ]);
    expect(workspace.assertOwner).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(repo.findManyByWorkspaceId).toHaveBeenCalledWith('workspace-1');
  });

  it('membuat pelaksana pada workspace dan menormalisasi nama', async () => {
    const { service, repo, workspace } = makeService();
    repo.create.mockResolvedValue(row);

    await service.create(user, {
      workspaceId: 'workspace-1',
      namaPelaksana: '  Staf Administrasi  ',
    });

    expect(workspace.assertOwner).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(repo.create).toHaveBeenCalledWith('workspace-1', 'Staf Administrasi');
  });

  it('memverifikasi ownership record sebelum update', async () => {
    const { service, repo } = makeService();
    repo.findOwnedByUser.mockResolvedValue(row);
    repo.updateNama.mockResolvedValue({ ...row, nama: 'Kasubbag' });

    await service.update(user, 'pelaksana-1', { namaPelaksana: ' Kasubbag ' });

    expect(repo.findOwnedByUser).toHaveBeenCalledWith('pelaksana-1', 'user-1');
    expect(repo.updateNama).toHaveBeenCalledWith('pelaksana-1', 'Kasubbag');
  });

  it('menolak penghapusan pelaksana yang masih direferensikan', async () => {
    const { service, repo } = makeService();
    repo.findOwnedByUser.mockResolvedValue(row);
    repo.countLangkahReferences.mockResolvedValue(1);

    await expect(service.remove(user, 'pelaksana-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });
});
