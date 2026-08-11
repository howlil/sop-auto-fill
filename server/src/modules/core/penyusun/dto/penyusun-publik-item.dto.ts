import { ApiProperty } from '@nestjs/swagger';

/** Satu penyusun dalam grup OPD (GET list). */
export class PenyusunPublikItemDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty()
  readonly nama!: string;

  @ApiProperty()
  readonly nip!: string;

  @ApiProperty()
  readonly jabatan!: string;

  @ApiProperty()
  readonly pangkat!: string;

  @ApiProperty()
  readonly email!: string;

  @ApiProperty()
  readonly nohp!: string;

  @ApiProperty({ enum: ['PENYUSUN', 'PJ_PENYUSUN'] })
  readonly peran!: 'PENYUSUN' | 'PJ_PENYUSUN';

  @ApiProperty({ enum: ['AKTIF', 'NONAKTIF'] })
  readonly status!: 'AKTIF' | 'NONAKTIF';
}
