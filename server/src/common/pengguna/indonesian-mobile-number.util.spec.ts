import { BadRequestException } from '@nestjs/common';
import {
  normalizeIndonesianMobileNumber,
  requireIndonesianMobileNumber,
} from './indonesian-mobile-number.util';

describe('Indonesian mobile number canonicalization', () => {
  it.each([
    ['081234567890', '6281234567890'],
    [' 081234567890 ', '6281234567890'],
    ['6281234567890', '6281234567890'],
  ])('menormalisasi %s menjadi %s', (input, expected) => {
    expect(normalizeIndonesianMobileNumber(input)).toBe(expected);
  });

  it.each(['81234567890', '+6281234567890', '0212345678', '0812-3456-7890', '0812abc'])(
    'menolak format input %s',
    (input) => {
      expect(normalizeIndonesianMobileNumber(input)).toBeNull();
    },
  );

  it('melempar BadRequestException untuk pemanggilan service dengan nomor invalid', () => {
    expect(() => requireIndonesianMobileNumber('nomor-rusak')).toThrow(BadRequestException);
  });
});
