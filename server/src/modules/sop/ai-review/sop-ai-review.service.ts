import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtAccessPayload } from '../../../common';
import { StatusSOP } from '../../../generated/prisma';
import { SopAiSnapshotRepository } from '../ai-common/sop-ai-snapshot.repository';
import { AI_REVIEW_PROVIDER, type AiReviewProvider } from './providers/ai-review-provider';
import { parseAndCanonicalizeAiReview } from './sop-ai-review.schema';
import type {
  SopQualityReviewProviderInput,
  SopQualityReviewResult,
  SopQualityReviewSnapshot,
} from './sop-ai-review.types';

export interface SopAiReviewResponse {
  reviewedDetailSopId: string;
  reviewedVersion: number;
  result: SopQualityReviewResult;
}

@Injectable()
export class SopAiReviewService {
  constructor(
    private readonly repository: SopAiSnapshotRepository,
    @Inject(AI_REVIEW_PROVIDER) private readonly provider: AiReviewProvider,
    private readonly config: ConfigService,
  ) {}

  availability(): { enabled: boolean } {
    return { enabled: this.providerMode() !== 'disabled' };
  }

  async review(user: JwtAccessPayload, detailSopId: string): Promise<SopAiReviewResponse> {
    if (this.providerMode() === 'disabled') {
      throw new ServiceUnavailableException('AI review belum tersedia');
    }

    const context = await this.repository.findContext(detailSopId);
    if (context === null) throw new NotFoundException('SOP tidak ditemukan');
    if (context.ownerId !== user.sub) throw new ForbiddenException('Akses SOP ditolak');
    if (context.status !== StatusSOP.DRAFT) {
      throw new ConflictException('AI review hanya tersedia untuk SOP draft');
    }

    const raw = await this.provider.review(this.toProviderInput(context.snapshot));
    let result: SopQualityReviewResult;
    try {
      result = parseAndCanonicalizeAiReview(raw, context.snapshot);
    } catch {
      throw new UnprocessableEntityException(
        'Hasil review AI tidak dapat digunakan. Jalankan review ulang.',
      );
    }

    return {
      reviewedDetailSopId: context.snapshot.detailSopId,
      reviewedVersion: context.snapshot.versi,
      result,
    };
  }

  private providerMode(): string {
    return this.config.get<string>('AI_REVIEW_PROVIDER') ?? 'disabled';
  }

  private toProviderInput(snapshot: SopQualityReviewSnapshot): SopQualityReviewProviderInput {
    return {
      versi: snapshot.versi,
      judul: snapshot.judul,
      nomorSop: snapshot.nomorSop,
      namaLembaga: snapshot.namaLembaga,
      peringatan: [...snapshot.peringatan],
      kualifikasiPelaksanaan: [...snapshot.kualifikasiPelaksanaan],
      peralatanPerlengkapan: [...snapshot.peralatanPerlengkapan],
      pencatatanPendataan: [...snapshot.pencatatanPendataan],
      actors: snapshot.actors.map(({ name, order }) => ({ name, order })),
      steps: snapshot.steps.map(({ langkahSopId: _langkahSopId, ...step }) => ({ ...step })),
    };
  }
}
