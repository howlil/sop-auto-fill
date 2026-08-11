/**
 * Peran untuk guard navigasi & UI — selaras dengan enum `PeranPengguna` di Prisma (server).
 */
export type RoleKey =
  | "PJ_EVALUATOR"
  | "EVALUATOR"
  | "KEPALA_OPD"
  | "PJ_PENYUSUN"
  | "PENYUSUN";

/** Alias semantik: nilai yang sama dengan kolom `Pengguna.peran` di database. */
export type PeranPengguna = RoleKey;

export type PermissionKey =
  | "view_dashboard"
  | "manage_sop"
  | "evaluate_sop"
  | "verify_sop"
  | "approve_sop"
  | "manage_users"
  | "manage_opd"
  | "manage_tim"
  | "view_reports"
  | "change_password"
  | "sign_documents";
