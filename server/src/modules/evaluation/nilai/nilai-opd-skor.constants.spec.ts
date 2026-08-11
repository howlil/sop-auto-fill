import {
  isNilaiOpdSkorValid,
  NILAI_OPD_SKOR_MAX,
  NILAI_OPD_SKOR_MIN,
} from './nilai-opd-skor.constants';

describe('Pengujian nilai OPD skor constants', () => {
  it('seharusnya menerima skor batas minimum dan maksimum', () => {
    expect(isNilaiOpdSkorValid(NILAI_OPD_SKOR_MIN)).toBe(true);
    expect(isNilaiOpdSkorValid(NILAI_OPD_SKOR_MAX)).toBe(true);
  });

  it('seharusnya menolak null, undefined, pecahan, dan skor di luar rentang', () => {
    expect(isNilaiOpdSkorValid(null)).toBe(false);
    expect(isNilaiOpdSkorValid(undefined)).toBe(false);
    expect(isNilaiOpdSkorValid(0)).toBe(false);
    expect(isNilaiOpdSkorValid(6)).toBe(false);
    expect(isNilaiOpdSkorValid(3.5)).toBe(false);
  });
});
