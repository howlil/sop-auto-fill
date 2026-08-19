import { InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma';
import type {
  SopTemplateDbRow,
  SopTemplateSummary,
  ValidatedTemplate,
  ValidatedTemplateStep,
} from './sop-template.types';

function invalidTemplate(): never {
  throw new InternalServerErrorException('Template sistem tidak valid');
}

function stringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return invalidTemplate();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return invalidTemplate();
    const trimmed = item.trim();
    if (trimmed.length > 0) result.push(trimmed);
  }
  return result;
}

export function normalizeActorName(name: string): string {
  return name.trim().toLocaleLowerCase('id-ID');
}

export function validateTemplate(row: SopTemplateDbRow): ValidatedTemplate {
  const steps = [...row.steps].sort((a, b) => a.urutan - b.urutan);
  const orders = new Set<number>();
  const actorNames: string[] = [];
  const actorKeys = new Set<string>();

  const mappedSteps: ValidatedTemplateStep[] = steps.map((step) => {
    const actorName = step.actorName.trim();
    if (!actorName || orders.has(step.urutan)) return invalidTemplate();
    orders.add(step.urutan);

    const actorKey = normalizeActorName(actorName);
    if (!actorKeys.has(actorKey)) {
      actorKeys.add(actorKey);
      actorNames.push(actorName);
    }

    return {
      urutan: step.urutan,
      kegiatan: step.kegiatan,
      jenis: step.jenis,
      kelengkapan: step.kelengkapan,
      keluaran: step.keluaran,
      waktu: step.waktu,
      satuanWaktu: step.satuanWaktu,
      keterangan: step.keterangan,
      actorName,
      targetYaUrutan: step.targetYaUrutan,
      targetTidakUrutan: step.targetTidakUrutan,
    };
  });

  for (const step of mappedSteps) {
    if (step.targetYaUrutan !== null && !orders.has(step.targetYaUrutan)) invalidTemplate();
    if (step.targetTidakUrutan !== null && !orders.has(step.targetTidakUrutan)) invalidTemplate();
  }

  return {
    templateId: row.templateId,
    key: row.key,
    name: row.name,
    description: row.description,
    version: row.version,
    peringatan: stringArray(row.peringatan),
    kualifikasiPelaksanaan: stringArray(row.kualifikasiPelaksanaan),
    peralatanPerlengkapan: stringArray(row.peralatanPerlengkapan),
    pencatatanPendataan: stringArray(row.pencatatanPendataan),
    steps: mappedSteps,
    actorNames,
  };
}

export function summarizeTemplate(template: ValidatedTemplate): SopTemplateSummary {
  return {
    templateId: template.templateId,
    key: template.key,
    name: template.name,
    description: template.description,
    version: template.version,
    stepCount: template.steps.length,
    actorNames: template.actorNames,
  };
}
