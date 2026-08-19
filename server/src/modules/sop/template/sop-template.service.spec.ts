import { NotFoundException } from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { JenisLangkahProsedur, SatuanWaktu, StatusSOP } from '../../../generated/prisma';
import { SopTemplateService } from './sop-template.service';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

const template = {
  templateId: 'template-1',
  key: 'pelayanan',
  name: 'Pelayanan',
  description: 'Template pelayanan',
  version: 1,
  isActive: true,
  peringatan: ['Pastikan persyaratan lengkap'],
  kualifikasiPelaksanaan: [],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: [],
  createdAt: new Date('2026-08-19T00:00:00.000Z'),
  updatedAt: new Date('2026-08-19T00:00:00.000Z'),
  steps: [
    {
      templateStepId: 'step-1',
      templateId: 'template-1',
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      kelengkapan: 'Permohonan',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: SatuanWaktu.m,
      keterangan: '',
      actorName: ' Petugas Layanan ',
      targetYaUrutan: null,
      targetTidakUrutan: null,
      createdAt: new Date('2026-08-19T00:00:00.000Z'),
      updatedAt: new Date('2026-08-19T00:00:00.000Z'),
    },
    {
      templateStepId: 'step-2',
      templateId: 'template-1',
      urutan: 2,
      kegiatan: 'Memproses layanan',
      jenis: JenisLangkahProsedur.KEGIATAN,
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil layanan',
      waktu: 15,
      satuanWaktu: SatuanWaktu.m,
      keterangan: '',
      actorName: 'Pelaksana Layanan',
      targetYaUrutan: null,
      targetTidakUrutan: null,
      createdAt: new Date('2026-08-19T00:00:00.000Z'),
      updatedAt: new Date('2026-08-19T00:00:00.000Z'),
    },
    {
      templateStepId: 'step-3',
      templateId: 'template-1',
      urutan: 3,
      kegiatan: 'Menyerahkan hasil',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      kelengkapan: 'Hasil layanan',
      keluaran: 'Layanan selesai',
      waktu: 5,
      satuanWaktu: SatuanWaktu.m,
      keterangan: '',
      actorName: 'Petugas Layanan',
      targetYaUrutan: null,
      targetTidakUrutan: null,
      createdAt: new Date('2026-08-19T00:00:00.000Z'),
      updatedAt: new Date('2026-08-19T00:00:00.000Z'),
    },
  ],
};

function makeService() {
  const repository = {
    listActiveTemplates: jest.fn(),
    findActiveTemplateById: jest.fn(),
    findWorkspaceActors: jest.fn(),
  };
  const workspace = { assertOwner: jest.fn().mockResolvedValue(undefined) };
  const draftInstantiation = { instantiate: jest.fn() };
  return {
    service: new SopTemplateService(repository as any, workspace as any, draftInstantiation as any),
    repository,
    workspace,
    draftInstantiation,
  };
}

describe('SopTemplateService', () => {
  it('menampilkan ringkasan template dengan aktor unik sesuai urutan kemunculan pertama', async () => {
    const { service, repository } = makeService();
    repository.listActiveTemplates.mockResolvedValue([template]);

    await expect(service.list()).resolves.toEqual([
      {
        templateId: 'template-1',
        key: 'pelayanan',
        name: 'Pelayanan',
        description: 'Template pelayanan',
        version: 1,
        stepCount: 3,
        actorNames: ['Petugas Layanan', 'Pelaksana Layanan'],
      },
    ]);
  });

  it('preview memvalidasi ownership dan memisahkan aktor reuse/create tanpa mutation', async () => {
    const { service, repository, workspace, draftInstantiation } = makeService();
    repository.findActiveTemplateById.mockResolvedValue(template);
    repository.findWorkspaceActors.mockResolvedValue([
      { pelaksanaId: 'actor-1', nama: 'petugas layanan' },
    ]);

    await expect(service.preview(user, 'template-1', 'workspace-1')).resolves.toEqual({
      template: expect.objectContaining({ templateId: 'template-1', stepCount: 3 }),
      actorsToReuse: [{ name: 'Petugas Layanan', pelaksanaId: 'actor-1' }],
      actorsToCreate: ['Pelaksana Layanan'],
      stepCount: 3,
      lampiranDefaults: {
        peringatan: ['Pastikan persyaratan lengkap'],
        peralatanPerlengkapan: ['Komputer'],
      },
    });

    expect(workspace.assertOwner).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(draftInstantiation.instantiate).not.toHaveBeenCalled();
  });

  it('menyembunyikan template yang tidak aktif atau tidak ditemukan', async () => {
    const { service, repository } = makeService();
    repository.findActiveTemplateById.mockResolvedValue(null);

    await expect(service.preview(user, 'missing', 'workspace-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('membuat draft melalui shared instantiator setelah ownership dan integritas template valid', async () => {
    const { service, repository, workspace, draftInstantiation } = makeService();
    repository.findActiveTemplateById.mockResolvedValue(template);
    draftInstantiation.instantiate.mockResolvedValue({
      sopId: 'sop-1',
      detailSopId: 'detail-1',
      workspaceId: 'workspace-1',
      status: StatusSOP.DRAFT,
    });

    await expect(
      service.create(user, 'template-1', {
        workspaceId: 'workspace-1',
        judul: ' SOP Pelayanan ',
        nomorSop: ' SOP-001 ',
        namaLembaga: ' Unit Pelayanan ',
      } as any),
    ).resolves.toEqual({
      sopId: 'sop-1',
      detailSopId: 'detail-1',
      workspaceId: 'workspace-1',
      status: StatusSOP.DRAFT,
    });

    expect(workspace.assertOwner).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(draftInstantiation.instantiate).toHaveBeenCalledWith({
      definition: {
        peringatan: ['Pastikan persyaratan lengkap'],
        kualifikasiPelaksanaan: [],
        peralatanPerlengkapan: ['Komputer'],
        pencatatanPendataan: [],
        actorNames: ['Petugas Layanan', 'Pelaksana Layanan'],
        steps: expect.arrayContaining([
          expect.objectContaining({ urutan: 1, actorName: 'Petugas Layanan' }),
          expect.objectContaining({ urutan: 2, actorName: 'Pelaksana Layanan' }),
        ]),
      },
      workspaceId: 'workspace-1',
      userId: 'user-1',
      judul: 'SOP Pelayanan',
      nomorSop: 'SOP-001',
      namaLembaga: 'Unit Pelayanan',
    });
  });
});
