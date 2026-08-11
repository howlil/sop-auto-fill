/**
 * Tanggal kalender Asia/Jakarta pada 00:00+07:00 dari instant pengesahan.
 * Dipakai untuk `DetailSOP.tanggalEfektif` saat Kepala OPD mengesahkan SOP.
 */
export function toWibDateOnly(instant: Date): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
  return new Date(`${ymd}T00:00:00+07:00`);
}
