import { z } from 'zod';
import type { SopAiSnapshot } from '../ai-common/sop-ai-snapshot.types';
import type { SopQualityFinding } from '../ai-review/sop-ai-review.types';
import type { SopAiRevisionSuggestion, SopAiRevisionTarget } from './sop-ai-revision.types';

const headerTargetSchema = z.object({ kind: z.literal('HEADER'), field: z.literal('JUDUL') }).strict();
const warningTargetSchema = z
  .object({ kind: z.literal('PERINGATAN'), itemIndex: z.number().int().min(0) })
  .strict();
const stepTargetSchema = z
  .object({
    kind: z.literal('STEP'),
    stepOrder: z.number().int().positive(),
    field: z.enum(['KEGIATAN', 'KELENGKAPAN', 'KELUARAN', 'KETERANGAN']),
  })
  .strict();

const targetSchema = z.discriminatedUnion('kind', [
  headerTargetSchema,
  warningTargetSchema,
  stepTargetSchema,
]);

const providerResultSchema = z
  .object({
    target: targetSchema,
    after: z.string().trim().min(1).max(2000),
    rationale: z.string().trim().min(3).max(1000),
  })
  .strict();

export function revisionTargetKey(target: SopAiRevisionTarget): string {
  if (target.kind === 'HEADER') return 'HEADER:JUDUL';
  if (target.kind === 'PERINGATAN') return `PERINGATAN:${target.itemIndex}`;
  return `STEP:${target.stepOrder}:${target.field}`;
}

export function deriveAllowedRevisionTargets(
  finding: SopQualityFinding,
  snapshot: SopAiSnapshot,
): SopAiRevisionTarget[] {
  if (finding.location.kind === 'HEADER') {
    return finding.category === 'CLARITY' ? [{ kind: 'HEADER', field: 'JUDUL' }] : [];
  }

  if (finding.location.kind === 'PERINGATAN') {
    if (!['CLARITY', 'SUPPORTING_FIELD', 'COMPLETENESS'].includes(finding.category)) return [];
    return snapshot.peringatan.map((_, itemIndex) => ({ kind: 'PERINGATAN', itemIndex }));
  }

  if (finding.location.kind !== 'STEP') return [];
  if (!snapshot.steps.some((step) => step.urutan === finding.location.stepOrder)) return [];

  const stepOrder = finding.location.stepOrder;
  switch (finding.category) {
    case 'CLARITY':
      return [
        { kind: 'STEP', stepOrder, field: 'KEGIATAN' },
        { kind: 'STEP', stepOrder, field: 'KETERANGAN' },
      ];
    case 'INPUT_OUTPUT':
      return [
        { kind: 'STEP', stepOrder, field: 'KELENGKAPAN' },
        { kind: 'STEP', stepOrder, field: 'KELUARAN' },
      ];
    case 'COMPLETENESS':
      return [
        { kind: 'STEP', stepOrder, field: 'KEGIATAN' },
        { kind: 'STEP', stepOrder, field: 'KELENGKAPAN' },
        { kind: 'STEP', stepOrder, field: 'KELUARAN' },
        { kind: 'STEP', stepOrder, field: 'KETERANGAN' },
      ];
    case 'SUPPORTING_FIELD':
      return [{ kind: 'STEP', stepOrder, field: 'KETERANGAN' }];
    default:
      return [];
  }
}

export function readRevisionTargetValue(
  target: SopAiRevisionTarget,
  snapshot: SopAiSnapshot,
): string {
  if (target.kind === 'HEADER') return snapshot.judul;
  if (target.kind === 'PERINGATAN') {
    const value = snapshot.peringatan[target.itemIndex];
    if (value === undefined) throw new Error('AI revision warning target is invalid');
    return value;
  }

  const step = snapshot.steps.find((item) => item.urutan === target.stepOrder);
  if (!step) throw new Error('AI revision step target is invalid');
  switch (target.field) {
    case 'KEGIATAN':
      return step.kegiatan;
    case 'KELENGKAPAN':
      return step.kelengkapan;
    case 'KELUARAN':
      return step.keluaran;
    case 'KETERANGAN':
      return step.keterangan;
  }
}

function validateTargetSpecificLength(target: SopAiRevisionTarget, after: string): void {
  const maxLength = target.kind === 'HEADER' ? 500 : 2000;
  if (after.length > maxLength) throw new Error('AI revision text exceeds field limit');
}

export function parseAndCanonicalizeAiRevision(
  raw: unknown,
  finding: SopQualityFinding,
  snapshot: SopAiSnapshot,
): SopAiRevisionSuggestion {
  const parsed = providerResultSchema.parse(raw);
  const allowedTargets = deriveAllowedRevisionTargets(finding, snapshot);
  const canonicalTarget = allowedTargets.find(
    (target) => revisionTargetKey(target) === revisionTargetKey(parsed.target),
  );
  if (!canonicalTarget) throw new Error('AI revision target is not allowed for this finding');

  const before = readRevisionTargetValue(canonicalTarget, snapshot);
  const after = parsed.after.trim();
  validateTargetSpecificLength(canonicalTarget, after);
  if (after === before.trim()) throw new Error('AI revision proposal does not change the target');

  return {
    target: canonicalTarget,
    before,
    after,
    rationale: parsed.rationale.trim(),
  };
}
