/**
 * Hook akses role & helpers — satu titik akses untuk UI.
 * Uses Zustand selectors with shallow comparison for optimal performance.
 */
import { useAuthStore } from "@/stores/authStore";
import { ROLES, ROLE_LABELS } from "@/utils/constants";
import type { RoleKey } from "@/types/dto/access.dto";
import { toNavigationRole } from "@/utils/role-key";

export { ROLES };

export function useAppRole() {
  const user = useAuthStore((state) => state.user);
  const role =
    user?.peran !== undefined ? toNavigationRole(user.peran) : undefined;

  const getRoleLabel = (r: RoleKey) => ROLE_LABELS[r] ?? r;
  const getRoleNip = () => user?.nip ?? "";
  const getRoleUserName = () => user?.nama ?? "";
  const getRoleDisplayName = () => user?.nama ?? "";

  return {
    role,
    user,
    getRoleLabel,
    getRoleNip,
    getRoleUserName,
    getRoleDisplayName,
    isPjEvaluator: role === ROLES.PJ_EVALUATOR,
    isEvaluator: role === ROLES.EVALUATOR,
    isKepalaOPD: role === ROLES.KEPALA_OPD,
    isPenyusun: role === ROLES.PENYUSUN,
    isPjPenyusun: role === ROLES.PJ_PENYUSUN,
  };
}
