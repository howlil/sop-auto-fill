import { validate } from 'class-validator';
import { RegisterTteDto } from './register-tte.dto';
import { UpdateTtePinDto } from './update-tte-pin.dto';

describe('Pengujian DTO Profil TTE', () => {
  it('seharusnya menerima PIN batas minimum dan maksimum untuk register', async () => {
    const min = new RegisterTteDto();
    Object.assign(min, { pin: '1234' });
    const max = new RegisterTteDto();
    Object.assign(max, { pin: 'x'.repeat(32) });

    await expect(validate(min)).resolves.toHaveLength(0);
    await expect(validate(max)).resolves.toHaveLength(0);
  });

  it('seharusnya menolak PIN register yang kosong, kurang dari 4, lebih dari 32, atau bukan string', async () => {
    const invalidValues = ['', '123', 'x'.repeat(33), 1234, null, undefined];

    for (const invalidValue of invalidValues) {
      const dto = new RegisterTteDto();
      Object.assign(dto, { pin: invalidValue });

      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('pin');
    }
  });

  it('seharusnya menerima PIN lama dan PIN baru pada batas valid untuk update', async () => {
    const dto = new UpdateTtePinDto();
    Object.assign(dto, {
      pinLama: '1234',
      pinBaru: 'x'.repeat(32),
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('seharusnya menolak update ketika PIN lama invalid', async () => {
    const invalidValues = ['', '123', 'x'.repeat(33), 1234, null, undefined];

    for (const invalidValue of invalidValues) {
      const dto = new UpdateTtePinDto();
      Object.assign(dto, {
        pinLama: invalidValue,
        pinBaru: '5678',
      });

      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('pinLama');
    }
  });

  it('seharusnya menolak update ketika PIN baru invalid', async () => {
    const invalidValues = ['', '123', 'x'.repeat(33), 5678, null, undefined];

    for (const invalidValue of invalidValues) {
      const dto = new UpdateTtePinDto();
      Object.assign(dto, {
        pinLama: '1234',
        pinBaru: invalidValue,
      });

      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('pinBaru');
    }
  });

  it('seharusnya tidak memaksa PIN numeric-only karena kontrak DTO hanya string panjang 4-32', async () => {
    const register = new RegisterTteDto();
    Object.assign(register, { pin: 'ab-12_!' });
    const update = new UpdateTtePinDto();
    Object.assign(update, { pinLama: 'ab-12_!', pinBaru: 'zz-99_!' });

    await expect(validate(register)).resolves.toHaveLength(0);
    await expect(validate(update)).resolves.toHaveLength(0);
  });
});
