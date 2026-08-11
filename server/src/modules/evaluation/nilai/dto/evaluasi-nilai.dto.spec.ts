import { validate } from 'class-validator';
import { HasilEvaluasi } from '../../../../generated/prisma';
import { IsiNilaiEvaluasiDto } from './isi-nilai-evaluasi.dto';
import { SelesaiEvaluasiDto } from './selesai-evaluasi.dto';
import { TolakPengajuanEvaluasiDto } from './tolak-pengajuan-evaluasi.dto';

describe('Pengujian DTO Evaluasi Nilai', () => {
  it('seharusnya menerima payload isi nilai valid', async () => {
    const dto = new IsiNilaiEvaluasiDto();
    Object.assign(dto, {
      hasil: HasilEvaluasi.PERLU_PERBAIKAN,
      catatan: 'Perbaiki lampiran',
      version: 0,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('seharusnya menolak hasil evaluasi di luar enum', async () => {
    const dto = new IsiNilaiEvaluasiDto();
    Object.assign(dto, { hasil: 'BURUK', version: 0 });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('hasil');
  });

  it('seharusnya menolak DITOLAK pada endpoint nilai per SOP', async () => {
    const dto = new IsiNilaiEvaluasiDto();
    Object.assign(dto, { hasil: HasilEvaluasi.DITOLAK, version: 0 });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('hasil');
  });

  it('seharusnya memvalidasi alasan dan version penolakan pengajuan', async () => {
    const valid = new TolakPengajuanEvaluasiDto();
    Object.assign(valid, { alasan: 'Tidak sesuai ruang lingkup', version: 0 });
    await expect(validate(valid)).resolves.toHaveLength(0);

    const invalid = new TolakPengajuanEvaluasiDto();
    Object.assign(invalid, { alasan: '', version: -1 });
    const errors = await validate(invalid);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['alasan', 'version']),
    );
  });

  it('seharusnya menolak version negatif dan pecahan', async () => {
    const negatif = new IsiNilaiEvaluasiDto();
    Object.assign(negatif, { hasil: HasilEvaluasi.SESUAI, version: -1 });
    const pecahan = new IsiNilaiEvaluasiDto();
    Object.assign(pecahan, { hasil: HasilEvaluasi.SESUAI, version: 1.5 });

    await expect(validate(negatif)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'version' })]),
    );
    await expect(validate(pecahan)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'version' })]),
    );
  });

  it('seharusnya menolak catatan yang melebihi batas panjang', async () => {
    const dto = new IsiNilaiEvaluasiDto();
    Object.assign(dto, {
      hasil: HasilEvaluasi.PERLU_PERBAIKAN,
      catatan: 'x'.repeat(65_001),
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('catatan');
  });

  it('seharusnya menerima payload selesai tanpa nilaiOPD karena validasi bisnis dilakukan di service', async () => {
    const dto = new SelesaiEvaluasiDto();
    Object.assign(dto, { nomorBA: 'BA-01' });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('seharusnya menerima nilaiOPD batas 1 dan 5', async () => {
    const min = new SelesaiEvaluasiDto();
    Object.assign(min, { nomorBA: 'BA-01', nilaiOPD: 1 });
    const max = new SelesaiEvaluasiDto();
    Object.assign(max, { nomorBA: 'BA-01', nilaiOPD: 5 });

    await expect(validate(min)).resolves.toHaveLength(0);
    await expect(validate(max)).resolves.toHaveLength(0);
  });

  it('seharusnya menolak nilaiOPD di luar 1 sampai 5 atau bukan integer', async () => {
    const terlaluKecil = new SelesaiEvaluasiDto();
    Object.assign(terlaluKecil, { nilaiOPD: 0 });
    const terlaluBesar = new SelesaiEvaluasiDto();
    Object.assign(terlaluBesar, { nilaiOPD: 6 });
    const pecahan = new SelesaiEvaluasiDto();
    Object.assign(pecahan, { nilaiOPD: 3.5 });

    for (const dto of [terlaluKecil, terlaluBesar, pecahan]) {
      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('nilaiOPD');
    }
  });
});
