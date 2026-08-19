import {
  HttpException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SopQualityReviewProviderInput } from '../sop-ai-review.types';
import { OpenAiReviewProvider } from './openai-ai-review.provider';

const providerInput: SopQualityReviewProviderInput = {
  versi: 2,
  judul: 'SOP Pelayanan',
  nomorSop: '001/SOP',
  namaLembaga: 'Unit Pelayanan',
  peringatan: ['Pastikan data benar'],
  kualifikasiPelaksanaan: ['Memahami layanan'],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: ['Register'],
  actors: [
    { name: 'Petugas', order: 1 },
    { name: 'Verifikator', order: 2 },
  ],
  steps: [
    {
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

const providerOutput = {
  status: 'PERLU_PERBAIKAN',
  summary: 'Ada keputusan yang perlu diperiksa sebelum SOP dinyatakan siap direview manusia.',
  findings: [
    {
      severity: 'WARNING',
      category: 'DECISION_ROUTING',
      location: { kind: 'STEP', stepOrder: 2 },
      title: 'Routing keputusan perlu diperjelas',
      explanation: 'Jalur Ya dan Tidak mengarah ke langkah yang sama sehingga alurnya ambigu.',
      recommendation: 'Pastikan masing-masing cabang keputusan mengarah ke langkah yang sesuai.',
    },
  ],
};

function makeProvider() {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'sk-test-secret';
      if (key === 'OPENAI_MODEL') return 'gpt-test-model';
      if (key === 'AI_REVIEW_TIMEOUT_MS') return 12345;
      return undefined;
    }),
  } as unknown as ConfigService;
  return new OpenAiReviewProvider(config);
}

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers({ 'x-request-id': 'req-review-test-1' }),
  } as unknown as Response;
}

describe('OpenAiReviewProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mengirim Responses API strict schema tanpa tools dan tanpa provider-side storage', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(providerOutput) }],
          },
        ],
      }),
    );

    await expect(makeProvider().review(providerInput)).resolves.toEqual(providerOutput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(request?.method).toBe('POST');
    expect(request?.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer sk-test-secret',
        'Content-Type': 'application/json',
      }),
    );
    expect(request?.signal).toBeDefined();

    const body = JSON.parse(String(request?.body));
    expect(body).toEqual(
      expect.objectContaining({
        model: 'gpt-test-model',
        store: false,
        instructions: expect.stringContaining('kepatuhan hukum'),
        input: expect.any(Array),
        text: {
          format: expect.objectContaining({
            type: 'json_schema',
            name: 'sop_quality_review',
            strict: true,
            schema: expect.objectContaining({
              type: 'object',
              additionalProperties: false,
            }),
          }),
        },
      }),
    );
    expect(body).not.toHaveProperty('tools');
    const serialized = JSON.stringify(body.input);
    expect(serialized).toContain('SOP Pelayanan');
    expect(serialized).toContain('Petugas');
    expect(serialized).not.toMatch(/detail-db|actor-db|step-db|user-/);
    expect(serialized).not.toContain('sk-test-secret');
  });

  it('memetakan rate limit menjadi 429 tanpa meneruskan provider body', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({ error: { message: 'raw quota detail' } }, { ok: false, status: 429 }),
    );

    const promise = makeProvider().review(providerInput);
    await expect(promise).rejects.toBeInstanceOf(HttpException);
    await expect(promise).rejects.toMatchObject({ status: 429 });
    await expect(promise).rejects.not.toThrow(/raw quota detail/);
  });

  it('memetakan provider HTTP failure dan network/timeout menjadi 503 yang aman', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockResponse({ error: { message: 'sensitive upstream detail' } }, { ok: false, status: 500 }),
    );
    await expect(makeProvider().review(providerInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('socket secret detail'));
    const promise = makeProvider().review(providerInput);
    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promise).rejects.not.toThrow(/socket secret detail/);
  });

  it('memetakan incomplete, refusal, output kosong, dan JSON invalid menjadi 422 retry-oriented', async () => {
    const cases = [
      { status: 'incomplete', output: [] },
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'cannot comply' }] }],
      },
      { status: 'completed', output: [] },
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{invalid' }] }],
      },
    ];

    for (const body of cases) {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(body));
      await expect(makeProvider().review(providerInput)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      jest.restoreAllMocks();
    }
  });

  it('menolak konfigurasi OpenAI yang tidak lengkap tanpa melakukan request', async () => {
    const config = {
      get: jest.fn((key: string) => (key === 'AI_REVIEW_TIMEOUT_MS' ? 10000 : undefined)),
    } as unknown as ConfigService;
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await expect(new OpenAiReviewProvider(config).review(providerInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
