import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtAccessPayload } from '../../../common';
import { JenisLangkahProsedur, Prisma, SatuanWaktu, StatusSOP } from '../../../generated/prisma';
import { SopAiDraftService } from './sop-ai-draft.service';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

const providerOutput = {
  suggestedTitle: 'SOP Pelayanan',
  peringatan: ['Pastikan data lengkap'],
  kualifikasiPelaksanaan: [],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: [],
  steps: [
    {
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      kelengkapan: 'Formulir',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Catat permohonan',
      actorName: 'Petugas Layanan',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
    {
      urutan: 2,
      kegiatan: 'Memverifikasi permohonan',
      jenis: JenisLangkahProsedur.KEPUTUSAN,
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil verifikasi',
      waktu: 10,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Tentukan kelengkapan',
      actorName: 'Verifikator',
      targetYaUrutan: 3,
      targetTidakUrutan: 1,
    },
    {
      urutan: 3,
      kegiatan: 'Menyerahkan hasil',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      kelengkapan: 'Hasil verifikasi',
      keluaran: 'Layanan selesai',
      waktu: 5,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Serahkan hasil',
      actorName: 'petugas layanan',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
  ],
};

function makeService(providerMode: 'disabled' | 'fake' | 'openai' = 'fake') {
  const repository = {
    findWorkspaceActors: jest.fn().mockResolvedValue([
      { pelaksanaId: 'actor-1', nama: ' petugas layanan ' },
    ]),
  };
  const workspace = { assertOwner: jest.fn().mockResolvedValue(undefined) };
  const provider = { generate: jest.fn().mockResolvedValue(providerOutput) };
  const instantiator = {
    instantiate: jest.fn().mockResolvedValue({
      sopId: 'sop-1',
      detailSopId: 'detail-1',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      status: StatusSOP.DRAFT,
    }),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'AI_DRAFT_PROVIDER') return providerMode;
      return undefined;
    }),
  } as unknown as ConfigService;

  return {
    service: new SopAiDraftService(
      repository as any,
      workspace as any,
      provider as any,
      instantiator as any,
      config,
    ),
    repository,
    workspace,
    provider,
    instantiator,
  };
}

describe('SopAiDraftService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('availability mengikuti provider server tanpa membocorkan model atau credential', () => {
    expect(makeService('disabled').service.availability()).toEqual({ enabled: false });
    expect(makeService('fake').service.availability()).toEqual({ enabled: true });
    expect(makeService('openai').service.availability()).toEqual({ enabled: true });
  });

  it('generation menolak provider disabled sebelum provider dipanggil', async () => {
    const { service, provider, repository } = makeService('disabled');

    await expect(
      service.generate(user, {
        workspaceId: '11111111-1111-4111-8111-111111111111',
        deskripsiProses: 'Proses penerimaan dan verifikasi permohonan layanan.',
      } as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(provider.generate).not.toHaveBeenCalled();
    expect(repository.findWorkspaceActors).not.toHaveBeenCalled();
  });

  it('generation assert ownership, mengirim maksimal 50 nama aktor tanpa ID, dan tidak melakukan persistence', async () => {
    const { service, workspace, repository, provider, instantiator } = makeService();
    repository.findWorkspaceActors.mockResolvedValue(
      Array.from({ length: 55 }, (_, index) => ({
        pelaksanaId: `secret-db-id-${index + 1}`,
        nama: `Aktor ${index + 1}`,
      })),
    );

    await service.generate(user, {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      deskripsiProses: 'Proses penerimaan dan verifikasi permohonan layanan.',
      tujuanProses: 'Memberikan layanan konsisten',
      catatanTambahan: 'Gunakan alur sederhana',
    } as any);

    expect(workspace.assertOwner).toHaveBeenCalledWith(
      'user-1',
      '11111111-1111-4111-8111-111111111111',
    );
    expect(provider.generate).toHaveBeenCalledTimes(1);
    const providerInput = provider.generate.mock.calls[0][0];
    expect(providerInput.workspaceActorNames).toHaveLength(50);
    expect(providerInput.workspaceActorNames[0]).toBe('Aktor 1');
    expect(JSON.stringify(providerInput)).not.toContain('secret-db-id');
    expect(instantiator.instantiate).not.toHaveBeenCalled();
  });

  it('mengembalikan proposal canonical dan klasifikasi actor reuse/create dari state workspace saat generate', async () => {
    const { service } = makeService();

    await expect(
      service.generate(user, {
        workspaceId: '11111111-1111-4111-8111-111111111111',
        deskripsiProses: 'Proses penerimaan dan verifikasi permohonan layanan.',
      } as any),
    ).resolves.toEqual({
      proposal: expect.objectContaining({
        suggestedTitle: 'SOP Pelayanan',
        actors: ['Petugas Layanan', 'Verifikator'],
        actorsToReuse: [{ name: 'Petugas Layanan', pelaksanaId: 'actor-1' }],
        actorsToCreate: ['Verifikator'],
        steps: expect.arrayContaining([
          expect.objectContaining({ urutan: 1, actorName: 'Petugas Layanan' }),
          expect.objectContaining({ urutan: 2, actorName: 'Verifikator' }),
          expect.objectContaining({ urutan: 3, actorName: 'Petugas Layanan' }),
        ]),
      }),
    });
  });

  it('confirmation revalidates proposal, mengabaikan actor reuse ID dari client, lalu memakai shared instantiator', async () => {
    const { service, instantiator, provider } = makeService();
    const generated = await service.generate(user, {
      workspaceId: '11111111-1111-4111-8111-111111111111',
      deskripsiProses: 'Proses penerimaan dan verifikasi permohonan layanan.',
    } as any);
    const tamperedClassification = {
      ...generated.proposal,
      actorsToReuse: [{ name: 'Verifikator', pelaksanaId: 'attacker-controlled-id' }],
      actorsToCreate: [],
    };

    await expect(
      service.create(user, {
        workspaceId: '11111111-1111-4111-8111-111111111111',
        judul: ' SOP Pelayanan ',
        nomorSop: ' SOP/AI/001 ',
        namaLembaga: ' Unit Pelayanan ',
        proposal: tamperedClassification,
      } as any),
    ).resolves.toEqual({
      sopId: 'sop-1',
      detailSopId: 'detail-1',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      status: StatusSOP.DRAFT,
    });

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(instantiator.instantiate).toHaveBeenCalledWith({
      definition: expect.objectContaining({
        actorNames: ['Petugas Layanan', 'Verifikator'],
        steps: expect.arrayContaining([
          expect.objectContaining({ actorName: 'Petugas Layanan' }),
          expect.objectContaining({ actorName: 'Verifikator' }),
        ]),
      }),
      workspaceId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      judul: 'SOP Pelayanan',
      nomorSop: 'SOP/AI/001',
      namaLembaga: 'Unit Pelayanan',
    });
  });

  it('confirmation menolak proposal yang diubah menjadi invalid sebelum transaction', async () => {
    const { service, instantiator } = makeService();

    await expect(
      service.create(user, {
        workspaceId: '11111111-1111-4111-8111-111111111111',
        judul: 'SOP Pelayanan',
        nomorSop: 'SOP/AI/001',
        namaLembaga: 'Unit Pelayanan',
        proposal: { ...providerOutput, steps: [providerOutput.steps[0]] },
      } as any),
    ).rejects.toBeDefined();

    expect(instantiator.instantiate).not.toHaveBeenCalled();
  });

  it('memetakan duplicate nomor SOP menjadi conflict tanpa menutupi error lain', async () => {
    const { service, instantiator } = makeService();
    instantiator.instantiate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.5.0',
      }),
    );

    await expect(
      service.create(user, {
        workspaceId: '11111111-1111-4111-8111-111111111111',
        judul: 'SOP Pelayanan',
        nomorSop: 'SOP/AI/001',
        namaLembaga: 'Unit Pelayanan',
        proposal: providerOutput,
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
