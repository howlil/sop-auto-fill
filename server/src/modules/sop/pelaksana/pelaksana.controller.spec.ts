import type { Request } from 'express';
import { PeranPengguna } from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../core/auth/helpers/auth.shared';
import { PelaksanaController } from './pelaksana.controller';
import { PelaksanaService } from './pelaksana.service';

describe('Pengujian PelaksanaController', () => {
  let controller: PelaksanaController;
  let service: jest.Mocked<Pick<PelaksanaService, 'list' | 'create' | 'update' | 'remove'>>;

  const user: JwtAccessPayload = {
    sub: 'user-1',
    email: 'penyusun@example.test',
    peran: PeranPengguna.PENYUSUN,
    sesiTokenVersion: 1,
  };
  const req = { user } as Request & { user: JwtAccessPayload };
  const responseRow = {
    id: 'pl-1',
    opdId: 'opd-1',
    namaPelaksana: 'Staf A',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    service = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new PelaksanaController(service as unknown as PelaksanaService);
  });

  it('seharusnya meneruskan user dan query opdId ke service list', async () => {
    service.list.mockResolvedValueOnce([responseRow]);

    const actual = await controller.list(req, 'opd-1');

    expect(service.list).toHaveBeenCalledWith(user, 'opd-1');
    expect(actual).toEqual({
      message: 'Daftar pelaksana berhasil diambil',
      success: true,
      data: [responseRow],
    });
  });

  it('seharusnya meneruskan user dan dto ke service create', async () => {
    const dto = { opdId: 'opd-1', namaPelaksana: 'Staf A' };
    service.create.mockResolvedValueOnce(responseRow);

    const actual = await controller.create(req, dto);

    expect(service.create).toHaveBeenCalledWith(user, dto);
    expect(actual).toEqual({
      message: 'Pelaksana berhasil ditambahkan',
      success: true,
      data: responseRow,
    });
  });

  it('seharusnya meneruskan user, id, dan dto ke service update', async () => {
    const dto = { namaPelaksana: 'Staf B' };
    service.update.mockResolvedValueOnce({ ...responseRow, namaPelaksana: 'Staf B' });

    const actual = await controller.update(req, 'pl-1', dto);

    expect(service.update).toHaveBeenCalledWith(user, 'pl-1', dto);
    expect(actual).toEqual({
      message: 'Pelaksana berhasil diperbarui',
      success: true,
      data: expect.objectContaining({ namaPelaksana: 'Staf B' }),
    });
  });

  it('seharusnya meneruskan user dan id ke service remove', async () => {
    service.remove.mockResolvedValueOnce(undefined);

    const actual = await controller.remove(req, 'pl-1');

    expect(service.remove).toHaveBeenCalledWith(user, 'pl-1');
    expect(actual).toEqual({
      message: 'Pelaksana berhasil dihapus',
      success: true,
      data: null,
    });
  });
});
