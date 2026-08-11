import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreatePenggunaProfilDto } from '../../pengguna/dto/create-pengguna-profil.dto';

/** Muatan data pembuatan akun Kepala OPD (sandi awal ditetapkan server). */
export class CreateKepalaOpdDto extends CreatePenggunaProfilDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  readonly opdId!: string;
}
