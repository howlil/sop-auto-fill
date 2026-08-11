import type { TteProfil } from "@/types/dto/tte.dto";

export function isTteProfileReady(
  profile: TteProfil | null | undefined,
): profile is TteProfil {
  return Boolean(profile?.hasP12);
}

export function isTteSetupRequiredError(error: unknown): boolean {
  const apiError = error as { message?: unknown; errors?: unknown; code?: unknown };
  const messages = [
    error instanceof Error ? error.message : "",
    typeof apiError.message === "string" ? apiError.message : "",
    Array.isArray(apiError.errors) ? apiError.errors.join(" ") : "",
    typeof apiError.code === "string" ? apiError.code : "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    messages.includes("kredensial tte belum dibuat") ||
    messages.includes("sertifikat tte personal belum diatur") ||
    messages.includes("sertifikat belum diatur") ||
    messages.includes("tte belum diatur") ||
    messages.includes("tte belum dibuat")
  );
}
