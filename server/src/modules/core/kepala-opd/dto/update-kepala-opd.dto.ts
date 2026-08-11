import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { UpdatePenggunaProfilDto } from '../../pengguna/dto/update-pengguna-profil.dto';

/** Pembaruan data Kepala OPD; status nonaktif digabung di PATCH. */
export class UpdateKepalaOpdDto extends UpdatePenggunaProfilDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Pindah penugasan ke OPD lain (slot harus kosong).',
  })
  @IsOptional()
  @IsUUID('4')
  readonly opdId?: string;
}
