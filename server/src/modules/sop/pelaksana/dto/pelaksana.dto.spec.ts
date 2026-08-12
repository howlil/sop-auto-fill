import { validate } from 'class-validator';
import { CreatePelaksanaDto } from './create-pelaksana.dto';
import { UpdatePelaksanaDto } from './update-pelaksana.dto';

describe('Pengujian DTO Pelaksana', () => {
  const validUuid = '11111111-1111-4111-8111-111111111111';

  it('seharusnya menerima create dengan workspaceId UUID valid', async () => {
    const dto = new CreatePelaksanaDto();
    Object.assign(dto, { workspaceId: validUuid, namaPelaksana: 'Staf A' });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('seharusnya menolak create tanpa workspaceId', async () => {
    const dto = new CreatePelaksanaDto();
    Object.assign(dto, { namaPelaksana: 'Staf A' });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('workspaceId');
  });

  it('seharusnya menolak create dengan workspaceId bukan UUID', async () => {
    const dto = new CreatePelaksanaDto();
    Object.assign(dto, { workspaceId: 'workspace-1', namaPelaksana: 'Staf A' });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('workspaceId');
  });

  it('seharusnya menolak namaPelaksana kosong pada create dan update', async () => {
    const createDto = new CreatePelaksanaDto();
    Object.assign(createDto, { workspaceId: validUuid, namaPelaksana: '' });
    const updateDto = new UpdatePelaksanaDto();
    Object.assign(updateDto, { namaPelaksana: '' });

    await expect(validate(createDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'namaPelaksana' })]),
    );
    await expect(validate(updateDto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'namaPelaksana' })]),
    );
  });

  it('seharusnya menolak namaPelaksana lebih dari 255 karakter', async () => {
    const dto = new UpdatePelaksanaDto();
    Object.assign(dto, { namaPelaksana: 'x'.repeat(256) });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('namaPelaksana');
  });

  it('seharusnya menolak namaPelaksana bukan string', async () => {
    const dto = new UpdatePelaksanaDto();
    Object.assign(dto, { namaPelaksana: 123 });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('namaPelaksana');
  });
});
