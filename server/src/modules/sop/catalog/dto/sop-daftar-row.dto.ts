import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TerakhirDieditDto } from './terakhir-diedit.dto';

export class SopDaftarRowDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty({ format: 'uuid' })
  readonly workspaceId!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly detailSopId!: string | null;

  @ApiProperty()
  readonly judul!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly nomorSop!: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly versi!: number | null;

  @ApiPropertyOptional({ nullable: true })
  readonly pembuat!: string | null;

  @ApiProperty({ type: () => TerakhirDieditDto })
  readonly terakhirDiedit!: TerakhirDieditDto;

  @ApiProperty()
  readonly status!: string;

  @ApiProperty()
  readonly statusLabel!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly peraturanId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly terakhirDiperbarui!: string | null;

  @ApiProperty()
  readonly canBuatVersiBaru!: boolean;

  @ApiProperty()
  readonly canHapusSopDraft!: boolean;

  @ApiProperty()
  readonly versionCount!: number;
}
