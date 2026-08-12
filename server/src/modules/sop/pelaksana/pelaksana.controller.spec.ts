import type { JwtAccessPayload } from '../../../common';
import { PelaksanaController } from './pelaksana.controller';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

const response = {
  id: 'pelaksana-1',
  workspaceId: 'workspace-1',
  namaPelaksana: 'Staf Administrasi',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
};

function makeController() {
  const service = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  return { controller: new PelaksanaController(service as any), service };
}

const req = { user } as any;

describe('PelaksanaController workspace API', () => {
  it('meneruskan workspaceId saat mengambil daftar', async () => {
    const { controller, service } = makeController();
    service.list.mockResolvedValue([response]);

    await expect(controller.list(req, 'workspace-1')).resolves.toEqual({
      message: 'Daftar pelaksana berhasil diambil',
      success: true,
      data: [response],
    });
    expect(service.list).toHaveBeenCalledWith(user, 'workspace-1');
  });

  it('membuat pelaksana dengan workspaceId dari body', async () => {
    const { controller, service } = makeController();
    const dto = { workspaceId: 'workspace-1', namaPelaksana: 'Staf Administrasi' };
    service.create.mockResolvedValue(response);

    await expect(controller.create(req, dto)).resolves.toEqual({
      message: 'Pelaksana berhasil ditambahkan',
      success: true,
      data: response,
    });
    expect(service.create).toHaveBeenCalledWith(user, dto);
  });

  it('meneruskan update berdasarkan id milik owner', async () => {
    const { controller, service } = makeController();
    const dto = { namaPelaksana: 'Kasubbag' };
    service.update.mockResolvedValue({ ...response, namaPelaksana: 'Kasubbag' });

    await controller.update(req, 'pelaksana-1', dto);

    expect(service.update).toHaveBeenCalledWith(user, 'pelaksana-1', dto);
  });

  it('mengembalikan envelope sukses setelah remove', async () => {
    const { controller, service } = makeController();

    await expect(controller.remove(req, 'pelaksana-1')).resolves.toEqual({
      message: 'Pelaksana berhasil dihapus',
      success: true,
      data: null,
    });
    expect(service.remove).toHaveBeenCalledWith(user, 'pelaksana-1');
  });
});
