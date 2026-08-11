import { buildNilaiEvaluasiClientId } from './nilai-evaluasi-client-id';

describe('Pengujian buildNilaiEvaluasiClientId', () => {
  it('seharusnya membangun id stabil dari pengajuanEvaluasiId dan detailSopId', () => {
    expect(buildNilaiEvaluasiClientId('pengajuan-1', 'detail-1')).toBe('pengajuan-1:detail-1');
  });
});
