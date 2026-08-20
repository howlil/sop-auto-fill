import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { StatusSOP } from '../../../generated/prisma';
import type { JwtAccessPayload } from '../../../common';
import type { SopQualityReviewSnapshot } from './sop-ai-review.types';
import { SopAiReviewService } from './sop-ai-review.service';

const user: JwtAccessPayload = {
  sub: 'user-1',
  email: 'user@example.test',
  name: 'User Test',
};

const snapshot: SopQualityReviewSnapshot = {
  detailSopId: 'detail-db-1',
  versi: 2,
  judul: 'SOP Pelayanan',
  nomorSop: '001/SOP',
  namaLembaga: 'Unit Pelayanan',
  peringatan: ['Pastikan data benar'],
  kualifikasiPelaksanaan: ['Memahami layanan'],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: ['Register'],
  actors: [
    { pelaksanaId: 'actor-db-1', name: 'Petugas', order: 1 },
    { pelaksanaId: 'actor-db-2', name: 'Verifikator', order: 2 },
  ],
  steps: [
    {
      langkahSopId: 'step-db-1',
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: 'AWAL_AKHIR',
      kelengkapan: 'Formulir',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: 'm',
      keterangan: 'Catat',
      actorName: 'Petugas',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
    {
      langkahSopId: 'step-db-2',
      urutan: 2,
      kegiatan: 'Memverifikasi permohonan',
      jenis: 'KEPUTUSAN',
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil verifikasi',
      waktu: 10,
      satuanWaktu: 'm',
      keterangan: 'Tentukan kelengkapan',
      actorName: 'Verifikator',
      targetYaUrutan: 1,
      targetTidakUrutan: 1,
    },
  ],
};

const validProviderResult = {
  status: 'PERLU_PERBAIKAN',
  summary: 'Ada routing keputusan yang perlu diperiksa.',
  findings: [
    {
      severity: 'WARNING',
      category: 'DECISION_ROUTING',
      location: { kind: 'STEP', stepOrder: 2 },
      title: 'Routing keputusan perlu diperjelas',
      explanation: 'Jalur Ya dan Tidak saat ini mengarah ke langkah yang sama.',
      recommendation: 'Bedakan tujuan kedua cabang keputusan.',
    },
  ],
};

function makeService(mode: 'disabled' | 'fake' | 'openai' = 'fake') {
  const repository = { findContext: jest.fn() };
  const provider = { review: jest.fn() };
  const config = {
    get: jest.fn((key: string) => (key === 'AI_REVIEW_PROVIDER' ? mode : undefined)),
  } as unknown as ConfigService;
  const service = new SopAiReviewService(repository as any, provider as any, config);
  return { service, repository, provider, config };
}

describe('SopAiReviewService', () => {
  it('menampilkan availability tanpa membocorkan provider', () => {
    expect(makeService('disabled').service.availability()).toEqual({ enabled: false });
    expect(makeService('fake').service.availability()).toEqual({ enabled: true });
  });

  it('menolak review sebelum membaca SOP ketika provider disabled', async () => {
    const { service, repository, provider } = makeService('disabled');

    await expect(service.review(user, 'detail-db-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repository.findContext).not.toHaveBeenCalled();
    expect(provider.review).not.toHaveBeenCalled();
  });

  it('memetakan SOP tidak ditemukan menjadi 404 tanpa memanggil provider', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue(null);

    await expect(service.review(user, 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(provider.review).not.toHaveBeenCalled();
  });

  it('memeriksa ownership sebelum provider invocation', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue({
      ownerId: 'other-user',
      status: StatusSOP.DRAFT,
      snapshot,
    });

    await expect(service.review(user, 'detail-db-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(provider.review).not.toHaveBeenCalled();
  });

  it.each([StatusSOP.COMPLETED, StatusSOP.ARCHIVED])(
    'menolak status %s sebelum provider invocation',
    async (status) => {
      const { service, repository, provider } = makeService();
      repository.findContext.mockResolvedValue({ ownerId: user.sub, status, snapshot });

      await expect(service.review(user, 'detail-db-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(provider.review).not.toHaveBeenCalled();
    },
  );

  it('mengirim hanya provider-safe snapshot tanpa application DB IDs', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue({
      ownerId: user.sub,
      status: StatusSOP.DRAFT,
      snapshot,
    });
    provider.review.mockResolvedValue(validProviderResult);

    await expect(service.review(user, 'detail-db-1')).resolves.toEqual({
      reviewedDetailSopId: 'detail-db-1',
      reviewedVersion: 2,
      result: validProviderResult,
    });

    expect(provider.review).toHaveBeenCalledTimes(1);
    const providerInput = provider.review.mock.calls[0][0];
    expect(providerInput).toEqual(
      expect.objectContaining({
        versi: 2,
        judul: 'SOP Pelayanan',
        actors: [
          { name: 'Petugas', order: 1 },
          { name: 'Verifikator', order: 2 },
        ],
        steps: [
          expect.objectContaining({ urutan: 1, actorName: 'Petugas' }),
          expect.objectContaining({ urutan: 2, actorName: 'Verifikator' }),
        ],
      }),
    );
    const serialized = JSON.stringify(providerInput);
    expect(serialized).not.toContain('detail-db-1');
    expect(serialized).not.toContain('actor-db-1');
    expect(serialized).not.toContain('actor-db-2');
    expect(serialized).not.toContain('step-db-1');
    expect(serialized).not.toContain('step-db-2');
    expect(serialized).not.toContain(user.sub);
    expect(serialized).not.toContain(user.email);
  });

  it('menolak structured output invalid dengan 422 aman', async () => {
    const { service, repository, provider } = makeService();
    repository.findContext.mockResolvedValue({
      ownerId: user.sub,
      status: StatusSOP.DRAFT,
      snapshot,
    });
    provider.review.mockResolvedValue({
      ...validProviderResult,
      findings: [
        {
          ...validProviderResult.findings[0],
          location: { kind: 'STEP', stepOrder: 999 },
        },
      ],
    });

    const promise = service.review(user, 'detail-db-1');
    await expect(promise).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(promise).rejects.not.toThrow(/999/);
  });
});
