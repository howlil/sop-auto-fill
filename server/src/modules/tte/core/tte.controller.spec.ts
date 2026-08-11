import type { Request } from 'express';
import { PeranPengguna } from '../../../generated/prisma';
import { TteController } from './tte.controller';
import type { TteService } from './tte.service';

describe('Pengujian TteController - Profil', () => {
  const user = {
    sub: 'user-1',
    email: 'kepala@test.id',
    peran: PeranPengguna.KEPALA_OPD,
  };
  const req = { user } as Request & { user: typeof user };
  const profil = {
    id: 'user-1',
    userId: 'user-1',
    peran: 'KEPALA_OPD' as const,
    createdAt: '2026-05-20T03:04:05.000Z',
    updatedAt: '2026-05-20T03:04:05.000Z',
    user: {
      id: 'user-1',
      nama: 'Kepala OPD',
      email: 'kepala@test.id',
      nip: '198001012006041001',
      jabatan: 'Kepala Dinas',
      pangkat: 'Pembina',
    },
  };

  function serviceMock(partial: Partial<jest.Mocked<TteService>> = {}): jest.Mocked<TteService> {
    return {
      getProfil: jest.fn(),
      registerProfil: jest.fn(),
      updateProfilPin: jest.fn(),
      getPengesahanPublic: jest.fn(),
      tandaTanganiBa: jest.fn(),
      tandaTanganiSemuaSopPengajuan: jest.fn(),
      signPdf: jest.fn(),
      getPdfSigningStatus: jest.fn(),
      verifyPdf: jest.fn(),
      ...partial,
    } as unknown as jest.Mocked<TteService>;
  }

  it('seharusnya mengembalikan pesan kredensial belum ada ketika profil null', async () => {
    const tteService = serviceMock({
      getProfil: jest.fn().mockResolvedValue(null),
    });

    await expect(new TteController(tteService).getProfil(req)).resolves.toEqual({
      message: 'Kredensial TTE belum ada',
      success: true,
      data: null,
    });
    expect(tteService.getProfil).toHaveBeenCalledWith(user);
  });

  it('seharusnya membungkus respons profil yang sudah ada', async () => {
    const tteService = serviceMock({
      getProfil: jest.fn().mockResolvedValue(profil),
    });

    await expect(new TteController(tteService).getProfil(req)).resolves.toEqual({
      message: 'Profil TTE berhasil diambil',
      success: true,
      data: profil,
    });
  });

  it('seharusnya mendelegasikan pendaftaran PIN profil', async () => {
    const dto = { pin: '1234' };
    const tteService = serviceMock({
      registerProfil: jest.fn().mockResolvedValue(profil),
    });

    await expect(new TteController(tteService).registerProfil(req, dto)).resolves.toEqual({
      message: 'PIN TTE berhasil diatur',
      success: true,
      data: profil,
    });
    expect(tteService.registerProfil).toHaveBeenCalledWith(user, dto);
  });

  it('seharusnya mendelegasikan perubahan PIN profil', async () => {
    const dto = { pinLama: '1234', pinBaru: '5678' };
    const tteService = serviceMock({
      updateProfilPin: jest.fn().mockResolvedValue(profil),
    });

    await expect(new TteController(tteService).updateProfilPin(req, dto)).resolves.toEqual({
      message: 'PIN TTE berhasil diperbarui',
      success: true,
      data: profil,
    });
    expect(tteService.updateProfilPin).toHaveBeenCalledWith(user, dto);
  });
});
