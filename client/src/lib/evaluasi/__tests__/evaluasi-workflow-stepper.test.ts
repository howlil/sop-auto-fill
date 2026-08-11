import { describe, expect, it } from 'vitest'
import {
  buildEvaluasiWorkflowSteps,
  getEvaluasiWorkflowActiveStep,
} from '../evaluasi-workflow-stepper'

describe('getEvaluasiWorkflowActiveStep', () => {
  it('should_map_SEDANG_DIEVALUASI_to_step_1', () => {
    expect(getEvaluasiWorkflowActiveStep('SEDANG_DIEVALUASI')).toBe(1)
  })
  it('should_keep_DITOLAK_at_step_1', () => {
    expect(getEvaluasiWorkflowActiveStep('DITOLAK')).toBe(1)
  })
  it('should_map_SELESAI_DIEVALUASI_to_step_2', () => {
    expect(getEvaluasiWorkflowActiveStep('SELESAI_DIEVALUASI')).toBe(2)
  })
  it('should_map_DITANDATANGANI_PJ_EVALUATOR_to_step_3', () => {
    expect(getEvaluasiWorkflowActiveStep('DITANDATANGANI_PJ_EVALUATOR')).toBe(3)
  })
  it('should_map_DITANDATANGANI_PJ_PENYUSUN_to_step_4', () => {
    expect(getEvaluasiWorkflowActiveStep('DITANDATANGANI_PJ_PENYUSUN')).toBe(4)
  })
  it('should_map_SELESAI_to_step_5', () => {
    expect(getEvaluasiWorkflowActiveStep('SELESAI')).toBe(5)
  })
})

describe('buildEvaluasiWorkflowSteps', () => {
  it('should_mark_prior_steps_done_when_pengajuan_at_step_3', () => {
    const steps = buildEvaluasiWorkflowSteps('DITANDATANGANI_PJ_EVALUATOR')
    expect(steps[0]?.state).toBe('done')
    expect(steps[1]?.state).toBe('done')
    expect(steps[2]?.state).toBe('current')
    expect(steps[3]?.state).toBe('upcoming')
    expect(steps[4]?.state).toBe('upcoming')
  })
  it('should_mark_all_done_when_pengajuan_SELESAI', () => {
    const steps = buildEvaluasiWorkflowSteps('SELESAI')
    expect(steps.every((s) => s.state === 'done')).toBe(true)
  })
})
