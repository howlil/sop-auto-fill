import type { RoleKey } from "@/types/dto/access.dto";

const ROLE_KEYS: readonly RoleKey[] = [
  "PJ_EVALUATOR",
  "EVALUATOR",
  "KEPALA_OPD",
  "PJ_PENYUSUN",
  "PENYUSUN",
] as const;

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * Memetakan string `peran` dari API / penyimpanan ke kunci navigasi bila valid.
 */
export function toNavigationRole(peran: string): RoleKey | undefined {
  return isRoleKey(peran) ? peran : undefined;
}
