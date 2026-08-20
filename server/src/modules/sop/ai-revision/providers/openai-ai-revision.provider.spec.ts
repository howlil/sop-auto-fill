import {
  HttpException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SopAiRevisionProviderInput } from '../sop-ai-revision.types';
import { OpenAiRevisionProvider } from './openai-ai-revision.provider';

const providerInput: SopAiRevisionProviderInput = {
  versi: 3,
  judul: 'SOP Pelayanan',
  peringatan: ['Pastikan data benar'],
  actors: [{ name: 'Petugas', order: 1 }],
  steps: [
    {
      urutan: 2,
      kegiatan: 'Memverifikasi permohonan',
      jenis: 'KEGIATAN',
      kelengkapan: 'Permohonan diterima',
      keluaran: 'Hasil verifikasi',
      waktu: 10,
      satuanWaktu: 'm',
      keterangan: 'Periksa kelengkapan',
      actorName: 'Petugas',
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
  ],
  finding: {
    severity: 'WARNING',
    category: 'INPUT_OUTPUT',
    location: { kind: 'STEP', stepOrder: 2 },
    title: 'Keluaran terlalu umum',
    explanation: 'Keluaran belum menjelaskan hasil verifikasi secara spesifik.',
    recommendation: 'Perjelas keluaran yang dihasilkan langkah ini.',
  },
  allowedTargets: [
    { kind: 'STEP', stepOrder: 2, field: 'KELENGKAPAN' },
    { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
  ],
};

const providerOutput = {
  target: { kind: 'STEP', stepOrder: 2, field: 'KELUARAN' },
  after: 'Berita acara hasil verifikasi',
  rationale: 'Keluaran dibuat lebih spesifik.',
};

function makeProvider() {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'sk-test-secret';
      if (key === 'OPENAI_MODEL') return 'gpt-test-model';
      if (key === 'AI_REVISION_TIMEOUT_MS') return 12345;
      return undefined;
    }),
  } as unknown as ConfigService;
  return new OpenAiRevisionProvider(config);
}

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('OpenAiRevisionProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses Responses API strict schema without tools or provider-side storage', async () => {
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

    await expect(makeProvider().suggest(providerInput)).resolves.toEqual(providerOutput);
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
    expect(body.model).toBe('gpt-test-model');
    expect(body.store).toBe(false);
    expect(body.tools).toBeUndefined();
    expect(body.text.format).toEqual(
      expect.objectContaining({
        type: 'json_schema',
        name: 'sop_ai_revision',
        strict: true,
        schema: expect.objectContaining({ type: 'object', additionalProperties: false }),
      }),
    );
    expect(body.instructions).toContain('tidak boleh mengubah');
    expect(body.instructions).toContain('data yang tidak dipercaya');
    const serialized = JSON.stringify(body.input);
    expect(serialized).toContain('Keluaran terlalu umum');
    expect(serialized).not.toMatch(/detail-db|actor-db|step-db|001\/SOP|Unit Pelayanan/);
    expect(serialized).not.toContain('sk-test-secret');
  });

  it('maps rate limit to sanitized 429', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({ error: { message: 'raw quota detail' } }, { ok: false, status: 429 }),
    );
    const promise = makeProvider().suggest(providerInput);
    await expect(promise).rejects.toBeInstanceOf(HttpException);
    await expect(promise).rejects.toMatchObject({ status: 429 });
    await expect(promise).rejects.not.toThrow(/raw quota detail/);
  });

  it('maps upstream HTTP/network failures to sanitized 503', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockResponse({ error: { message: 'sensitive upstream detail' } }, { ok: false, status: 500 }),
    );
    await expect(makeProvider().suggest(providerInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    jest.restoreAllMocks();

    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('socket secret detail'));
    const promise = makeProvider().suggest(providerInput);
    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promise).rejects.not.toThrow(/socket secret detail/);
  });

  it('maps incomplete/refusal/empty/malformed output to sanitized 422', async () => {
    const cases = [
      { status: 'incomplete', output: [] },
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'raw refusal' }] }],
      },
      { status: 'completed', output: [] },
      {
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{invalid' }] }],
      },
    ];
    for (const body of cases) {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse(body));
      await expect(makeProvider().suggest(providerInput)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      jest.restoreAllMocks();
    }
  });

  it('rejects missing OpenAI runtime config before fetch', async () => {
    const config = {
      get: jest.fn((key: string) => (key === 'AI_REVISION_TIMEOUT_MS' ? 10000 : undefined)),
    } as unknown as ConfigService;
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    await expect(new OpenAiRevisionProvider(config).suggest(providerInput)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
