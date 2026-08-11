import { describe, expect, it } from "vitest";
import {
  assertCanMutateEvaluasiNilai,
  canMutateEvaluasiNilai,
} from "@/lib/evaluasi/evaluasi-permissions";

describe("evaluasi-permissions", () => {
  it("should_allow_only_evaluator", () => {
    expect(canMutateEvaluasiNilai("EVALUATOR")).toBe(true);
    expect(canMutateEvaluasiNilai("PJ_EVALUATOR")).toBe(false);
    expect(canMutateEvaluasiNilai("PJ_PENYUSUN")).toBe(false);
    expect(canMutateEvaluasiNilai(undefined)).toBe(false);
  });

  it("should_throw_when_assert_fails", () => {
    expect(() => assertCanMutateEvaluasiNilai("PJ_EVALUATOR")).toThrow(
      /Hanya evaluator/,
    );
  });
});
