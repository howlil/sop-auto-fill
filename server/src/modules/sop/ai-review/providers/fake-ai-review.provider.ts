import { Injectable } from '@nestjs/common';
import type { SopQualityReviewProviderInput } from '../sop-ai-review.types';
import type { AiReviewProvider } from './ai-review-provider';

@Injectable()
export class FakeAiReviewProvider implements AiReviewProvider {
  async review(input: SopQualityReviewProviderInput): Promise<unknown> {
    const decision = input.steps.find((step) => step.jenis === 'KEPUTUSAN');
    const target = decision ?? input.steps[0];

    if (!target) {
      return {
        status: 'PERLU_PERBAIKAN',
        summary: 'SOP belum memiliki langkah prosedur yang dapat ditinjau secara menyeluruh.',
        findings: [
          {
            severity: 'ERROR',
            category: 'COMPLETENESS',
            location: { kind: 'HEADER' },
            title: 'Langkah prosedur belum tersedia',
            explanation: 'Review tidak menemukan langkah prosedur pada snapshot SOP yang tersimpan.',
            recommendation: 'Tambahkan langkah prosedur yang diperlukan lalu jalankan review kembali.',
          },
        ],
      };
    }

    return {
      status: 'CUKUP_BAIK',
      summary: 'Struktur dasar SOP dapat ditinjau, tetapi beberapa bagian tetap memerlukan pemeriksaan manusia.',
      findings: [
        {
          severity: 'WARNING',
          category: decision ? 'DECISION_ROUTING' : 'CLARITY',
          location: { kind: 'STEP', stepOrder: target.urutan },
          title: decision ? 'Periksa kembali routing keputusan' : 'Perjelas uraian langkah',
          explanation: decision
            ? 'Pastikan kondisi keputusan dan tujuan setiap cabang dapat dipahami tanpa penafsiran ganda.'
            : 'Uraian langkah perlu dipastikan cukup spesifik agar dapat dilaksanakan secara konsisten.',
          recommendation: decision
            ? 'Tinjau kembali kondisi Ya/Tidak dan pastikan setiap cabang mengarah ke langkah yang tepat.'
            : 'Periksa kembali kegiatan, input, output, pelaksana, dan keterangannya.',
        },
      ],
    };
  }
}
