export function getValidasiPengesahanUrl(dokumenTteId: string, userId: string): string {
  return `${window.location.origin}/validasi/pengesahan/${dokumenTteId}/${userId}`;
}
