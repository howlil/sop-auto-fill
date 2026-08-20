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
import type { SopAiSnapshot } from '../ai-common/sop-ai-snapshot.types';
import type { SopQualityFinding } from '../ai-review/sop-ai-review.types';
import { AI_REVISION_PROVIDER, type AiRevisionProvider } from './providers/ai-revision-provider';
import {
  deriveAllowedRevisionTargets,
  parseAndCanonicalizeAiRevision,
} from './sop-ai-revision.schema';
import type {
  SopAiRevisionProviderInput,
  SopAiRevisionTarget,
  SuggestAiRevisionResponse,
} from './sop-ai-revision.types';

@Injectable()
export class SopAiRevisionService {
  constructor(
    private readonly repository: SopAiSnapshotRepository,
    @Inject(AI_REVISION_PROVIDER) private readonly provider: AiRevisionProvider,
    private readonly config: ConfigService,
  ) {}

  availability(): { enabled: boolean } {
    return { enabled: this.providerMode() !== 'disabled' };
  }

  async suggest(
    user: JwtAccessPayload,
    detailSopId: string,
    finding: SopQualityFinding,
  ): Promise<SuggestAiRevisionResponse> {
    if (this.providerMode() === 'disabled') {
      throw new ServiceUnavailableException('AI revision belum tersedia');
    }

    const context = await this.repository.findContext(detailSopId);
    if (context === null) throw new NotFoundException('SOP tidak ditemukan');
    if (context.ownerId !== user.sub) throw new ForbiddenException('Akses SOP ditolak');
    if (context.status !== StatusSOP.DRAFT) {
      throw new ConflictException('AI revision hanya tersedia untuk SOP draft');
    }

    const allowedTargets = deriveAllowedRevisionTargets(finding, context.snapshot);
    if (allowedTargets.length === 0) {
      throw new UnprocessableEntityException('Temuan ini perlu diperbaiki secara manual');
    }

    const raw = await this.provider.suggest(
      this.toProviderInput(context.snapshot, finding, allowedTargets),
    );

    try {
      return {
        sourceDetailSopId: context.snapshot.detailSopId,
        sourceVersion: context.snapshot.versi,
        suggestion: parseAndCanonicalizeAiRevision(raw, finding, context.snapshot),
      };
    } catch {
      throw new UnprocessableEntityException(
        'Usulan perbaikan AI tidak dapat digunakan. Minta usulan ulang.',
      );
    }
  }

  private providerMode(): string {
    return this.config.get<string>('AI_REVISION_PROVIDER') ?? 'disabled';
  }

  private toProviderInput(
    snapshot: SopAiSnapshot,
    finding: SopQualityFinding,
    allowedTargets: SopAiRevisionTarget[],
  ): SopAiRevisionProviderInput {
    return {
      versi: snapshot.versi,
      judul: snapshot.judul,
      peringatan: [...snapshot.peringatan],
      actors: snapshot.actors.map(({ name, order }) => ({ name, order })),
      steps: snapshot.steps.map(({ langkahSopId: _langkahSopId, ...step }) => ({ ...step })),
      finding: {
        ...finding,
        location: { ...finding.location },
      },
      allowedTargets: allowedTargets.map((target) => ({ ...target })),
    };
  }
}
