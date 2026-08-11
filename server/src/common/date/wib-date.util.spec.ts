import { toWibDateOnly } from './wib-date.util';

describe('Pengujian fungsi toWibDateOnly', () => {
  it('seharusnya menormalkan waktu WIB ke tengah malam pada tanggal kalender yang sama', () => {
    const input = new Date('2026-05-19T23:30:00+07:00');
    const actual = toWibDateOnly(input);
    expect(actual.toISOString()).toBe('2026-05-18T17:00:00.000Z');
    expect(actual.getTime()).toBe(new Date('2026-05-19T00:00:00+07:00').getTime());
  });

  it('seharusnya menggunakan tanggal kalender Jakarta ketika UTC masih hari sebelumnya', () => {
    const input = new Date('2026-05-19T20:00:00.000Z');
    const actual = toWibDateOnly(input);
    expect(actual.getTime()).toBe(new Date('2026-05-20T00:00:00+07:00').getTime());
  });
  it('seharusnya menangani rollover bulan dan tahun secara akurat (Edge Case - Tahun Baru WIB)', () => {
    // 31 Dec 2026 23:00 UTC -> 1 Jan 2027 06:00 WIB
    const input = new Date('2026-12-31T23:00:00.000Z');
    const actual = toWibDateOnly(input);
    expect(actual.toISOString()).toBe('2026-12-31T17:00:00.000Z'); // 2027-01-01T00:00:00+07:00
  });
});
