const CANONICAL_PATTERN = /^628\d{7,12}$/;
const LOCAL_PATTERN = /^08\d{7,12}$/;

/** Normalisasi nomor seluler Indonesia ke 628... tanpa tanda plus. */
export function normalizeIndonesianMobileNumber(value: string): string | null {
  const trimmed = value.trim();
  if (CANONICAL_PATTERN.test(trimmed)) return trimmed;
  if (LOCAL_PATTERN.test(trimmed)) return `62${trimmed.slice(1)}`;
  return null;
}

/** Format ramah input; nomor kanonik 628... ditampilkan kembali sebagai 08.... */
export function formatIndonesianMobileNumberForInput(value?: string | null): string {
  const normalized = value ? normalizeIndonesianMobileNumber(value) : null;
  return normalized?.startsWith("62") ? `0${normalized.slice(2)}` : (value?.trim() ?? "");
}
