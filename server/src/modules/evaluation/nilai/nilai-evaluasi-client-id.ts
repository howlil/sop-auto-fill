/** Identifier stabil untuk muatan data JSON (bukan kolom DB). */
export function buildNilaiEvaluasiClientId(
  pengajuanEvaluasiId: string,
  detailSopId: string,
): string {
  return `${pengajuanEvaluasiId}:${detailSopId}`;
}
