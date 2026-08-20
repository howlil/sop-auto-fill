import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SopQualityReviewProviderInput } from '../sop-ai-review.types';
import type { AiReviewProvider } from './ai-review-provider';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const REVIEW_INSTRUCTIONS = [
  'Anda meninjau kualitas internal draft SOP administratif berdasarkan data yang diberikan aplikasi.',
  'Review bersifat advisory dan harus menggunakan hanya fakta pada input.',
  'Jangan menyatakan atau menyimpulkan kepatuhan hukum, kepatuhan terhadap peraturan tertentu, persetujuan resmi, atau sertifikasi.',
  'Jangan mengarang peraturan, dasar hukum, identitas, fakta, atau konteks di luar input.',
  'Jangan meminta atau menggunakan alat eksternal, web search, file search, retrieval, atau function calling.',
  'Fokus pada struktur proses, tanggung jawab aktor, kesinambungan input/output, routing keputusan, kejelasan instruksi, field pendukung, kewajaran waktu, dan sinyal kelengkapan.',
  'Setiap finding harus menunjuk lokasi yang benar-benar ada pada input dan mengikuti schema output secara ketat.',
].join(' ');

const simpleLocationSchemas = [
  locationKindSchema('HEADER'),
  locationKindSchema('PERINGATAN'),
  locationKindSchema('KUALIFIKASI_PELAKSANAAN'),
  locationKindSchema('PERALATAN_PERLENGKAPAN'),
  locationKindSchema('PENCATATAN_PENDATAAN'),
] as const;

const SOP_QUALITY_REVIEW_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'summary', 'findings'],
  properties: {
    status: {
      type: 'string',
      enum: ['PERLU_PERBAIKAN', 'CUKUP_BAIK', 'SIAP_DIREVIEW'],
    },
    summary: { type: 'string', minLength: 10, maxLength: 1500 },
    findings: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'severity',
          'category',
          'location',
          'title',
          'explanation',
          'recommendation',
        ],
        properties: {
          severity: { type: 'string', enum: ['ERROR', 'WARNING', 'SUGGESTION'] },
          category: {
            type: 'string',
            enum: [
              'PROCESS_STRUCTURE',
              'ACTOR_RESPONSIBILITY',
              'INPUT_OUTPUT',
              'DECISION_ROUTING',
              'CLARITY',
              'SUPPORTING_FIELD',
              'TIME_PLAUSIBILITY',
              'COMPLETENESS',
            ],
          },
          location: {
            anyOf: [
              ...simpleLocationSchemas,
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'actorName'],
                properties: {
                  kind: { type: 'string', enum: ['ACTOR'] },
                  actorName: { type: 'string', minLength: 1, maxLength: 255 },
                },
              },
              {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'stepOrder'],
                properties: {
                  kind: { type: 'string', enum: ['STEP'] },
                  stepOrder: { type: 'integer', minimum: 1 },
                },
              },
            ],
          },
          title: { type: 'string', minLength: 3, maxLength: 160 },
          explanation: { type: 'string', minLength: 10, maxLength: 1000 },
          recommendation: { type: 'string', minLength: 3, maxLength: 1000 },
        },
      },
    },
  },
} as const;

function locationKindSchema(kind: string) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['kind'],
    properties: { kind: { type: 'string', enum: [kind] } },
  } as const;
}

function retryError(): UnprocessableEntityException {
  return new UnprocessableEntityException(
    'Hasil review AI tidak dapat digunakan. Jalankan review ulang.',
  );
}

@Injectable()
export class OpenAiReviewProvider implements AiReviewProvider {
  constructor(private readonly config: ConfigService) {}

  async review(input: SopQualityReviewProviderInput): Promise<unknown> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const model = this.config.get<string>('OPENAI_MODEL');
    const timeout = this.config.get<number>('AI_REVIEW_TIMEOUT_MS') ?? 30000;
    if (!apiKey || !model) {
      throw new ServiceUnavailableException('AI review belum dikonfigurasi');
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
          instructions: REVIEW_INSTRUCTIONS,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: JSON.stringify(input),
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'sop_quality_review',
              strict: true,
              schema: SOP_QUALITY_REVIEW_JSON_SCHEMA,
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
      if (payload.status !== 'completed') throw retryError();

      for (const item of payload.output ?? []) {
        if (item.type !== 'message') continue;
        for (const content of item.content ?? []) {
          if (content.type === 'refusal') throw retryError();
          if (
            content.type !== 'output_text' ||
            !('text' in content) ||
            typeof content.text !== 'string'
          ) {
            continue;
          }
          try {
            return JSON.parse(content.text) as unknown;
          } catch {
            throw retryError();
          }
        }
      }

      throw retryError();
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
