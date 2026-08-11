/** Id stabil untuk muatan data JSON lini masa (bukan UUID); PK komposit dipisah unit separator. */
export function encodeLogNilaiEvaluasiClientId(
  pengajuanEvaluasiId: string,
  detailSopId: string,
  penggunaId: string,
  createdAt: Date,
): string {
  return `${pengajuanEvaluasiId}\u001f${detailSopId}\u001f${penggunaId}\u001f${createdAt.toISOString()}`;
}
