import { z } from 'zod';
import { normalizeActorName } from '../draft/sop-draft-normalization';
import type {
  SopQualityFinding,
  SopQualityFindingLocation,
  SopQualityReviewResult,
  SopQualityReviewSnapshot,
} from './sop-ai-review.types';

const severitySchema = z.enum(['ERROR', 'WARNING', 'SUGGESTION']);
const statusSchema = z.enum(['PERLU_PERBAIKAN', 'CUKUP_BAIK', 'SIAP_DIREVIEW']);
const categorySchema = z.enum([
  'PROCESS_STRUCTURE',
  'ACTOR_RESPONSIBILITY',
  'INPUT_OUTPUT',
  'DECISION_ROUTING',
  'CLARITY',
  'SUPPORTING_FIELD',
  'TIME_PLAUSIBILITY',
  'COMPLETENESS',
]);

const simpleLocationSchemas = [
  z.object({ kind: z.literal('HEADER') }).strict(),
  z.object({ kind: z.literal('PERINGATAN') }).strict(),
  z.object({ kind: z.literal('KUALIFIKASI_PELAKSANAAN') }).strict(),
  z.object({ kind: z.literal('PERALATAN_PERLENGKAPAN') }).strict(),
  z.object({ kind: z.literal('PENCATATAN_PENDATAAN') }).strict(),
] as const;

const locationSchema = z.discriminatedUnion('kind', [
  ...simpleLocationSchemas,
  z.object({ kind: z.literal('ACTOR'), actorName: z.string().trim().min(1).max(255) }).strict(),
  z.object({ kind: z.literal('STEP'), stepOrder: z.number().int().positive() }).strict(),
]);

const findingSchema = z
  .object({
    severity: severitySchema,
    category: categorySchema,
    location: locationSchema,
    title: z.string().trim().min(3).max(160),
    explanation: z.string().trim().min(10).max(1000),
    recommendation: z.string().trim().min(3).max(1000),
  })
  .strict();

const reviewSchema = z
  .object({
    status: statusSchema,
    summary: z.string().trim().min(10).max(1500),
    findings: z.array(findingSchema).max(30),
  })
  .strict();

function locationKey(location: SopQualityFindingLocation): string {
  if (location.kind === 'STEP') return `STEP:${location.stepOrder}`;
  if (location.kind === 'ACTOR') return `ACTOR:${normalizeActorName(location.actorName)}`;
  return location.kind;
}

function findingKey(finding: SopQualityFinding): string {
  return [
    finding.severity,
    finding.category,
    locationKey(finding.location),
    finding.title.toLocaleLowerCase('id-ID'),
  ].join('|');
}

function canonicalizeLocation(
  location: SopQualityFindingLocation,
  snapshot: SopQualityReviewSnapshot,
): SopQualityFindingLocation {
  if (location.kind === 'STEP') {
    if (!snapshot.steps.some((step) => step.urutan === location.stepOrder)) {
      throw new Error(`AI review references unknown step order: ${location.stepOrder}`);
    }
    return location;
  }

  if (location.kind === 'ACTOR') {
    const normalized = normalizeActorName(location.actorName);
    const actor = snapshot.actors.find((item) => normalizeActorName(item.name) === normalized);
    if (!actor) throw new Error(`AI review references unknown actor: ${location.actorName}`);
    return { kind: 'ACTOR', actorName: actor.name };
  }

  return location;
}

export function parseAndCanonicalizeAiReview(
  raw: unknown,
  snapshot: SopQualityReviewSnapshot,
): SopQualityReviewResult {
  const parsed = reviewSchema.parse(raw);
  const findings: SopQualityFinding[] = parsed.findings.map((finding) => ({
    ...finding,
    location: canonicalizeLocation(finding.location, snapshot),
  }));

  const seen = new Set<string>();
  const deduplicated: SopQualityFinding[] = [];
  for (const finding of findings) {
    const key = findingKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push(finding);
  }

  return {
    status: parsed.status,
    summary: parsed.summary,
    findings: deduplicated,
  };
}
