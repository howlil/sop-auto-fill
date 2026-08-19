import {
  HttpException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OpenAiDraftProvider } from './openai-draft.provider';

const input = {
  deskripsiProses: 'Proses penerimaan, verifikasi, dan penyelesaian permohonan layanan.',
  tujuanProses: 'Memastikan layanan konsisten',
  catatanTambahan: 'Gunakan alur sederhana',
  workspaceActorNames: ['Petugas Layanan', 'Verifikator'],
};

const providerOutput = {
  suggestedTitle: 'SOP Pelayanan Permohonan',
  peringatan: ['Pastikan data lengkap'],
  kualifikasiPelaksanaan: [],
  peralatanPerlengkapan: ['Komputer'],
  pencatatanPendataan: [],
  steps: [
    {
      urutan: 1,
      kegiatan: 'Menerima permohonan',
      jenis: 'AWAL_AKHIR',
      kelengkapan: 'Formulir',
      keluaran: 'Permohonan diterima',
      waktu: 5,
      satuanWaktu: 'm',
      keterangan: 'Catat permohonan',
      actorName: 'Petugas Layanan',
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
      targetYaUrutan: 3,
      targetTidakUrutan: 1,
    },
    {
      urutan: 3,
      kegiatan: 'Menyerahkan hasil',
      jenis: 'AWAL_AKHIR',
      kelengkapan: 'Hasil verifikasi',
      keluaran: 'Layanan selesai',
      waktu: 5,
      satuanWaktu: 'm',
      keterangan: 'Serahkan hasil',
      actorName: 'Petugas Layanan',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
  ],
};

function makeProvider() {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'sk-test-secret';
      if (key === 'OPENAI_MODEL') return 'gpt-test-model';
      if (key === 'AI_DRAFT_TIMEOUT_MS') return 12345;
      return undefined;
    }),
  } as unknown as ConfigService;
  return new OpenAiDraftProvider(config);
}

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: jest.fn().mockResolvedValue(body),
    headers: new Headers({ 'x-request-id': 'req-test-1' }),
  } as unknown as Response;
}

describe('OpenAiDraftProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mengirim Responses API strict JSON schema tanpa tools dan tanpa provider-side storage', async () => {
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

    await expect(makeProvider().generate(input)).resolves.toEqual(providerOutput);

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
        input: expect.any(Array),
        instructions: expect.stringContaining('Jangan mengarang'),
        text: {
          format: expect.objectContaining({
            type: 'json_schema',
            name: 'sop_ai_draft',
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
    expect(JSON.stringify(body.input)).toContain('Petugas Layanan');
    expect(JSON.stringify(body.input)).not.toContain('sk-test-secret');
  });

  it('memetakan rate limit menjadi 429 tanpa meneruskan provider body', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({ error: { message: 'raw provider quota details' } }, { ok: false, status: 429 }),
    );

    const promise = makeProvider().generate(input);
    await expect(promise).rejects.toBeInstanceOf(HttpException);
    await expect(promise).rejects.toMatchObject({ status: 429 });
    await expect(promise).rejects.not.toThrow(/raw provider quota details/);
  });

  it('memetakan provider HTTP failure dan network/timeout menjadi 503 yang aman', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockResponse({ error: { message: 'sensitive upstream detail' } }, { ok: false, status: 500 }),
    );
    await expect(makeProvider().generate(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('socket secret detail'));
    const promise = makeProvider().generate(input);
    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promise).rejects.not.toThrow(/socket secret detail/);
  });

  it('memetakan incomplete, refusal, output kosong, dan JSON invalid menjadi 422 regenerate-oriented', async () => {
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
      await expect(makeProvider().generate(input)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      jest.restoreAllMocks();
    }
  });
});
