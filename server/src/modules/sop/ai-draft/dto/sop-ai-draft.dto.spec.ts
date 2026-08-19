import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAiDraftDto } from './create-ai-draft.dto';
import { GenerateAiDraftDto } from './generate-ai-draft.dto';

const workspaceId = '11111111-1111-4111-8111-111111111111';

describe('GenerateAiDraftDto', () => {
  it('trim input dan mengubah optional whitespace menjadi undefined', async () => {
    const dto = plainToInstance(GenerateAiDraftDto, {
      workspaceId,
      deskripsiProses: `  ${'Proses penerimaan dan verifikasi permohonan layanan.'}  `,
      tujuanProses: '  Memastikan permohonan diproses konsisten.  ',
      catatanTambahan: '   ',
    });

    expect(dto.deskripsiProses).toBe('Proses penerimaan dan verifikasi permohonan layanan.');
    expect(dto.tujuanProses).toBe('Memastikan permohonan diproses konsisten.');
    expect(dto.catatanTambahan).toBeUndefined();
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    { field: 'deskripsiProses', value: '   ' },
    { field: 'deskripsiProses', value: 'terlalu pendek' },
    { field: 'deskripsiProses', value: 'x'.repeat(8001) },
    { field: 'tujuanProses', value: 'x'.repeat(2001) },
    { field: 'catatanTambahan', value: 'x'.repeat(2001) },
  ])('menolak $field di luar contract', async ({ field, value }) => {
    const dto = plainToInstance(GenerateAiDraftDto, {
      workspaceId,
      deskripsiProses: 'Proses penerimaan dan verifikasi permohonan layanan.',
      [field]: value,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === field)).toBe(true);
  });

  it('menolak workspaceId non UUID', async () => {
    const dto = plainToInstance(GenerateAiDraftDto, {
      workspaceId: 'workspace-1',
      deskripsiProses: 'Proses penerimaan dan verifikasi permohonan layanan.',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'workspaceId')).toBe(true);
  });
});

describe('CreateAiDraftDto', () => {
  const proposal = {
    suggestedTitle: 'SOP Pelayanan',
    peringatan: [],
    kualifikasiPelaksanaan: [],
    peralatanPerlengkapan: [],
    pencatatanPendataan: [],
    actors: ['Petugas'],
    actorsToReuse: [],
    actorsToCreate: ['Petugas'],
    steps: [],
  };

  it('trim identity dan menerima proposal object untuk revalidation service', async () => {
    const dto = plainToInstance(CreateAiDraftDto, {
      workspaceId,
      judul: '  SOP Pelayanan  ',
      nomorSop: '  SOP/AI/001  ',
      namaLembaga: '  Unit Pelayanan  ',
      proposal,
    });

    expect(dto.judul).toBe('SOP Pelayanan');
    expect(dto.nomorSop).toBe('SOP/AI/001');
    expect(dto.namaLembaga).toBe('Unit Pelayanan');
    expect(dto.proposal).toStrictEqual(proposal);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['judul', 'nomorSop', 'namaLembaga'] as const)(
    'menolak %s whitespace-only',
    async (field) => {
      const dto = plainToInstance(CreateAiDraftDto, {
        workspaceId,
        judul: 'SOP Pelayanan',
        nomorSop: 'SOP/AI/001',
        namaLembaga: 'Unit Pelayanan',
        proposal,
        [field]: '   ',
      });

      const errors = await validate(dto);
      expect(errors.some((error) => error.property === field)).toBe(true);
    },
  );

  it('menolak proposal yang bukan object', async () => {
    const dto = plainToInstance(CreateAiDraftDto, {
      workspaceId,
      judul: 'SOP Pelayanan',
      nomorSop: 'SOP/AI/001',
      namaLembaga: 'Unit Pelayanan',
      proposal: 'not-an-object',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'proposal')).toBe(true);
  });
});
