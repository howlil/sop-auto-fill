import { Injectable } from '@nestjs/common';
import type { AiRevisionProvider } from './ai-revision-provider';
import type {
  SopAiRevisionProviderInput,
  SopAiRevisionTarget,
} from '../sop-ai-revision.types';

function currentValue(input: SopAiRevisionProviderInput, target: SopAiRevisionTarget): string {
  if (target.kind === 'HEADER') return input.judul;
  if (target.kind === 'PERINGATAN') return input.peringatan[target.itemIndex] ?? '';
  const step = input.steps.find((item) => item.urutan === target.stepOrder);
  if (!step) return '';
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

@Injectable()
export class FakeAiRevisionProvider implements AiRevisionProvider {
  async suggest(input: SopAiRevisionProviderInput): Promise<unknown> {
    const target = input.allowedTargets[0];
    if (!target) throw new Error('Fake AI revision provider requires one allowed target');
    const before = currentValue(input, target);
    const suffix = ' yang diperjelas';
    const maxLength = target.kind === 'HEADER' ? 500 : 2000;
    const base = before.trim() || 'Informasi SOP';
    const after = `${base.slice(0, Math.max(1, maxLength - suffix.length))}${suffix}`;
    return {
      target,
      after,
      rationale: 'Usulan deterministik untuk pengujian AI-assisted revision.',
    };
  }
}
