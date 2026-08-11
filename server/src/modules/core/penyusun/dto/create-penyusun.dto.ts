import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { CreatePenggunaProfilDto } from '../../pengguna/dto/create-pengguna-profil.dto';

/** Body POST penambahan penyusun / PJ penyusun per OPD. */
export class CreatePenyusunDto extends CreatePenggunaProfilDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly opdId!: string;

  @ApiProperty({ enum: ['PENYUSUN', 'PJ_PENYUSUN'] })
  @IsIn(['PENYUSUN', 'PJ_PENYUSUN'])
  readonly peran!: 'PENYUSUN' | 'PJ_PENYUSUN';
}
