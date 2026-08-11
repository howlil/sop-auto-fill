import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChangePasswordDto } from './change-password.dto';
import { LoginDto } from './login.dto';
import { UpdateMyPhoneDto } from './update-my-phone.dto';

describe('Pengujian DTO Auth', () => {
  it('seharusnya menerima payload login valid', async () => {
    const dto = new LoginDto();
    dto.email = 'user@example.test';
    dto.password = 'secret';
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('seharusnya menolak email login yang tidak valid', async () => {
    const dto = new LoginDto();
    dto.email = 'bukan-email';
    dto.password = 'secret';
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('email');
  });

  it('seharusnya menolak password login kosong', async () => {
    const dto = new LoginDto();
    dto.email = 'user@example.test';
    dto.password = '';
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('password');
  });

  it('seharusnya menerima payload ubah password valid', async () => {
    const dto = new ChangePasswordDto();
    Object.assign(dto, {
      kataSandiLama: 'old-pass',
      kataSandiBaru: 'new-pass-8',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('seharusnya menolak password baru kurang dari delapan karakter', async () => {
    const dto = new ChangePasswordDto();
    Object.assign(dto, {
      kataSandiLama: 'old-pass',
      kataSandiBaru: 'short',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('kataSandiBaru');
  });

  it('seharusnya menolak password lama kosong', async () => {
    const dto = new ChangePasswordDto();
    Object.assign(dto, {
      kataSandiLama: '',
      kataSandiBaru: 'new-pass-8',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('kataSandiLama');
  });

  it('seharusnya menormalisasi nomor HP lokal menjadi format 628', async () => {
    const dto = plainToInstance(UpdateMyPhoneDto, { nohp: ' 081234567890 ' });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.nohp).toBe('6281234567890');
  });

  it.each(['', '+6281234567890', '0812-3456-7890', 'nomor-rusak'])(
    'seharusnya menolak nomor HP tidak valid: %s',
    async (nohp) => {
      const dto = plainToInstance(UpdateMyPhoneDto, { nohp });
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('nohp');
    },
  );
});
