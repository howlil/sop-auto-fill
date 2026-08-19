import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiDraftGenerationInput, AiDraftProviderOutput } from '../sop-ai-draft.types';
import type { AiDraftProvider } from './ai-draft-provider';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const SOP_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'suggestedTitle',
    'peringatan',
    'kualifikasiPelaksanaan',
    'peralatanPerlengkapan',
    'pencatatanPendataan',
    'steps',
  ],
  properties: {
    suggestedTitle: { type: 'string', minLength: 2, maxLength: 500 },
    peringatan: stringArraySchema(),
    kualifikasiPelaksanaan: stringArraySchema(),
    peralatanPerlengkapan: stringArraySchema(),
    pencatatanPendataan: stringArraySchema(),
    steps: {
      type: 'array',
      minItems: 2,
      maxItems: 25,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'urutan',
          'kegiatan',
          'jenis',
          'kelengkapan',
          'keluaran',
          'waktu',
          'satuanWaktu',
          'keterangan',
          'actorName',
          'targetYaUrutan',
          'targetTidakUrutan',
        ],
        properties: {
          urutan: { type: 'integer', minimum: 1 },
          kegiatan: { type: 'string', minLength: 1, maxLength: 500 },
          jenis: { type: 'string', enum: ['AWAL_AKHIR', 'KEGIATAN', 'KEPUTUSAN'] },
          kelengkapan: { type: 'string', minLength: 1, maxLength: 500 },
          keluaran: { type: 'string', minLength: 1, maxLength: 500 },
          waktu: { type: 'integer', minimum: 1, maximum: 525600 },
          satuanWaktu: { type: 'string', enum: ['m', 'h', 'd', 'w', 'mo', 'y'] },
          keterangan: { type: 'string', minLength: 1, maxLength: 500 },
          actorName: { type: 'string', minLength: 1, maxLength: 255 },
          targetYaUrutan: nullablePositiveIntegerSchema(),
          targetTidakUrutan: nullablePositiveIntegerSchema(),
        },
      },
    },
  },
} as const;

function stringArraySchema() {
  return {
    type: 'array',
    maxItems: 20,
    items: { type: 'string', maxLength: 500 },
  } as const;
}

function nullablePositiveIntegerSchema() {
  return {
    anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }],
  } as const;
}

function regenerateError(): UnprocessableEntityException {
  return new UnprocessableEntityException(
    'Draft AI tidak dapat digunakan. Perbarui deskripsi lalu generate ulang.',
  );
}

@Injectable()
export class OpenAiDraftProvider implements AiDraftProvider {
  constructor(private readonly config: ConfigService) {}

  async generate(input: AiDraftGenerationInput): Promise<AiDraftProviderOutput> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const model = this.config.get<string>('OPENAI_MODEL');
    const timeout = this.config.get<number>('AI_DRAFT_TIMEOUT_MS') ?? 30000;
    if (!apiKey || !model) {
      throw new ServiceUnavailableException('AI drafting belum dikonfigurasi');
    }

    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(timeout),
        body: JSON.stringify({
          model,
          store: false,
          instructions:
            'Anda membantu menyusun draft prosedur SOP administratif dari fakta yang diberikan pengguna. Jangan mengarang dasar hukum, peraturan, nomor dokumen, identitas organisasi, atau fakta yang tidak diberikan. Jangan menggunakan alat eksternal. Susun langkah operasional yang jelas dan konsisten dengan schema output.',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify({
                    deskripsiProses: input.deskripsiProses,
                    ...(input.tujuanProses ? { tujuanProses: input.tujuanProses } : {}),
                    ...(input.catatanTambahan
                      ? { catatanTambahan: input.catatanTambahan }
                      : {}),
                    workspaceActorNames: input.workspaceActorNames,
                  }),
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'sop_ai_draft',
              strict: true,
              schema: SOP_DRAFT_SCHEMA,
            },
          },
        }),
      });

      if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
        throw new HttpException(
          'Layanan AI sedang mencapai batas penggunaan. Coba lagi nanti.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (!response.ok) {
        throw new ServiceUnavailableException('Layanan AI sedang tidak tersedia');
      }

      const payload = (await response.json()) as OpenAiResponsePayload;
      if (payload.status !== 'completed') throw regenerateError();

      for (const item of payload.output ?? []) {
        if (item.type !== 'message') continue;
        for (const content of item.content ?? []) {
          if (content.type === 'refusal') throw regenerateError();
          if (content.type !== 'output_text' || typeof content.text !== 'string') continue;
          try {
            return JSON.parse(content.text) as AiDraftProviderOutput;
          } catch {
            throw regenerateError();
          }
        }
      }

      throw regenerateError();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Layanan AI sedang tidak tersedia');
    }
  }
}

type OpenAiResponsePayload = {
  status?: string;
  output?: Array<{
    type?: string;
    content?: Array<
      | { type?: 'output_text'; text?: string }
      | { type?: 'refusal'; refusal?: string }
      | { type?: string }
    >;
  }>;
};
