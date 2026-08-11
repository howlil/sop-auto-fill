import type { StatusPengajuanEvaluasi } from '@/types/dto/evaluasi.dto'

export const EVALUASI_WORKFLOW_STEPS = [
  { id: 1, label: 'Penilaian tim' },
  { id: 2, label: 'Tanda Tangan BA' },
  { id: 3, label: 'Tanda Tangan BA OPD' },
  { id: 4, label: 'Pengesahan SOP' },
  { id: 5, label: 'Selesai' },
] as const

export type EvaluasiWorkflowStepState = 'done' | 'current' | 'upcoming'

export interface EvaluasiWorkflowStepView {
  id: number
  label: string
  state: EvaluasiWorkflowStepState
}

/** Indeks langkah aktif (1–5) dari status pengajuan evaluasi. */
export function getEvaluasiWorkflowActiveStep(
  status: StatusPengajuanEvaluasi | string | undefined,
): number {
  switch (status) {
    case 'SEDANG_DIEVALUASI':
    case 'DITOLAK':
      return 1
    case 'SELESAI_DIEVALUASI':
      return 2
    case 'DITANDATANGANI_PJ_EVALUATOR':
      return 3
    case 'DITANDATANGANI_PJ_PENYUSUN':
      return 4
    case 'SELESAI':
      return 5
    default:
      return 1
  }
}

export function buildEvaluasiWorkflowSteps(
  status: StatusPengajuanEvaluasi | string | undefined,
): EvaluasiWorkflowStepView[] {
  const active = getEvaluasiWorkflowActiveStep(status)
  return EVALUASI_WORKFLOW_STEPS.map((step) => {
    let state: EvaluasiWorkflowStepState = 'upcoming'
    if (step.id < active) {
      state = 'done'
    } else if (step.id === active) {
      state = status === 'SELESAI' ? 'done' : 'current'
    }
    return { ...step, state }
  })
}
