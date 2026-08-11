import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { UpdatePenggunaProfilDto } from '../../pengguna/dto/update-pengguna-profil.dto';

/** Body PATCH pembaruan penyusun. */
export class UpdatePenyusunDto extends UpdatePenggunaProfilDto {
  @ApiPropertyOptional({ enum: ['PENYUSUN', 'PJ_PENYUSUN'] })
  @IsOptional()
  @IsIn(['PENYUSUN', 'PJ_PENYUSUN'])
  readonly peran?: 'PENYUSUN' | 'PJ_PENYUSUN';
}
