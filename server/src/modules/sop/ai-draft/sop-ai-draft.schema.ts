import { UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import { JenisLangkahProsedur, SatuanWaktu } from '../../../generated/prisma';
import { normalizeActorName } from '../draft/sop-draft-normalization';
import type { CanonicalAiDraftContent } from './sop-ai-draft.types';

const requiredText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.trim())
    .refine((value) => value.length > 0);

const lampiran = z
  .array(z.string().max(500).transform((value) => value.trim()))
  .max(20)
  .transform((items) => items.filter((item) => item.length > 0));

const providerStepSchema = z.object({
  urutan: z.number().int().positive(),
  kegiatan: requiredText(500),
  jenis: z.nativeEnum(JenisLangkahProsedur),
  kelengkapan: requiredText(500),
  keluaran: requiredText(500),
  waktu: z.number().int().min(1).max(525600),
  satuanWaktu: z.nativeEnum(SatuanWaktu),
  keterangan: requiredText(500),
  actorName: requiredText(255),
  targetYaUrutan: z.number().int().positive().nullable(),
  targetTidakUrutan: z.number().int().positive().nullable(),
});

const providerOutputSchema = z.object({
  suggestedTitle: z
    .string()
    .max(500)
    .transform((value) => value.trim())
    .refine((value) => value.length >= 2),
  peringatan: lampiran,
  kualifikasiPelaksanaan: lampiran,
  peralatanPerlengkapan: lampiran,
  pencatatanPendataan: lampiran,
  steps: z.array(providerStepSchema).min(2).max(25),
});

function invalidProviderOutput(): never {
  throw new UnprocessableEntityException(
    'Draft AI tidak memenuhi struktur SOP. Perbarui deskripsi lalu generate ulang.',
  );
}

export function parseAndCanonicalizeAiDraft(input: unknown): CanonicalAiDraftContent {
  const parsed = providerOutputSchema.safeParse(input);
  if (!parsed.success) return invalidProviderOutput();

  const sortedSteps = [...parsed.data.steps].sort((left, right) => left.urutan - right.urutan);
  const originalOrders = new Set<number>();
  for (const step of sortedSteps) {
    if (originalOrders.has(step.urutan)) return invalidProviderOutput();
    originalOrders.add(step.urutan);
  }

  for (const step of sortedSteps) {
    const isDecision = step.jenis === JenisLangkahProsedur.KEPUTUSAN;
    if (isDecision) {
      if (step.targetYaUrutan === null && step.targetTidakUrutan === null) {
        return invalidProviderOutput();
      }
      if (
        step.targetYaUrutan !== null &&
        step.targetTidakUrutan !== null &&
        step.targetYaUrutan === step.targetTidakUrutan
      ) {
        return invalidProviderOutput();
      }
    } else if (step.targetYaUrutan !== null || step.targetTidakUrutan !== null) {
      return invalidProviderOutput();
    }

    if (step.targetYaUrutan !== null && !originalOrders.has(step.targetYaUrutan)) {
      return invalidProviderOutput();
    }
    if (step.targetTidakUrutan !== null && !originalOrders.has(step.targetTidakUrutan)) {
      return invalidProviderOutput();
    }
  }

  const newOrderByOriginal = new Map<number, number>();
  sortedSteps.forEach((step, index) => newOrderByOriginal.set(step.urutan, index + 1));

  const actors: string[] = [];
  const canonicalActorByKey = new Map<string, string>();
  const steps = sortedSteps.map((step, index) => {
    const actorKey = normalizeActorName(step.actorName);
    let canonicalActor = canonicalActorByKey.get(actorKey);
    if (!canonicalActor) {
      canonicalActor = step.actorName;
      canonicalActorByKey.set(actorKey, canonicalActor);
      actors.push(canonicalActor);
    }

    return {
      urutan: index + 1,
      kegiatan: step.kegiatan,
      jenis: step.jenis,
      kelengkapan: step.kelengkapan,
      keluaran: step.keluaran,
      waktu: step.waktu,
      satuanWaktu: step.satuanWaktu,
      keterangan: step.keterangan,
      actorName: canonicalActor,
      targetYaUrutan:
        step.targetYaUrutan === null ? null : newOrderByOriginal.get(step.targetYaUrutan)!,
      targetTidakUrutan:
        step.targetTidakUrutan === null
          ? null
          : newOrderByOriginal.get(step.targetTidakUrutan)!,
    };
  });

  return {
    suggestedTitle: parsed.data.suggestedTitle,
    peringatan: parsed.data.peringatan,
    kualifikasiPelaksanaan: parsed.data.kualifikasiPelaksanaan,
    peralatanPerlengkapan: parsed.data.peralatanPerlengkapan,
    pencatatanPendataan: parsed.data.pencatatanPendataan,
    actors,
    steps,
  };
}
