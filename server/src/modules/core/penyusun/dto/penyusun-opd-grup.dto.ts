import { ApiProperty } from '@nestjs/swagger';
import { PenyusunPublikItemDto } from './penyusun-publik-item.dto';

/** Grup penyusun per OPD untuk GET /api/v1/penyusun */
export class PenyusunOpdGrupDto {
  @ApiProperty({ format: 'uuid' })
  readonly opdId!: string;

  @ApiProperty()
  readonly namaOpd!: string;

  @ApiProperty({ type: [PenyusunPublikItemDto] })
  readonly penyusun!: PenyusunPublikItemDto[];
}
