import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSopFromTemplateDto } from './create-sop-from-template.dto';

const validPayload = {
  workspaceId: '11111111-1111-4111-8111-111111111111',
  judul: 'SOP Pelayanan',
  nomorSop: 'SOP/001',
  namaLembaga: 'Biro Organisasi',
};

describe('CreateSopFromTemplateDto', () => {
  it.each(['judul', 'nomorSop', 'namaLembaga'] as const)(
    'rejects whitespace-only %s',
    async (field) => {
      const dto = plainToInstance(CreateSopFromTemplateDto, {
        ...validPayload,
        [field]: '   ',
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === field)).toBe(true);
    },
  );

  it('trims identity fields before validation and persistence', async () => {
    const dto = plainToInstance(CreateSopFromTemplateDto, {
      ...validPayload,
      judul: '  SOP Pelayanan  ',
      nomorSop: '  SOP/001  ',
      namaLembaga: '  Biro Organisasi  ',
    });

    expect(dto.judul).toBe('SOP Pelayanan');
    expect(dto.nomorSop).toBe('SOP/001');
    expect(dto.namaLembaga).toBe('Biro Organisasi');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
