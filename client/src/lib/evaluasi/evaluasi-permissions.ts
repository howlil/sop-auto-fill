import type { PeranPengguna } from "@/types/dto/access.dto";

/** No 19–20: hanya Evaluator yang boleh mengisi nilai dan menyelesaikan pengajuan. */
export function canMutateEvaluasiNilai(peran: PeranPengguna | undefined): boolean {
  return peran === "EVALUATOR";
}

export function assertCanMutateEvaluasiNilai(peran: PeranPengguna | undefined): void {
  if (!canMutateEvaluasiNilai(peran)) {
    throw new Error(
      "Hanya evaluator yang dapat menilai dan menyelesaikan pengajuan evaluasi",
    );
  }
}
